import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";
import { insertTeamMemberAE } from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

/* -------------------- Validators & Helpers -------------------- */

type MemberRole = "LEADER" | "MEMBER" | "SUBSTITUTE" | "COACH";
const ROLES = new Set<MemberRole>(["LEADER", "MEMBER", "SUBSTITUTE", "COACH"]);

function toRole(v: unknown): MemberRole {
  const r = String(v ?? "MEMBER").toUpperCase() as MemberRole;
  return ROLES.has(r) ? r : "MEMBER";
}

// Reasonable, practical email check (not overkill)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAFE_TEXT = /^[A-Za-z0-9 .,'!@#&()_\-/:?]+$/u;         // general safe text
const SAFE_TEAM = /^[A-Za-z0-9 .,'&()_\-]+$/u;               // team names
const SAFE_DISCORD = /^[A-Za-z0-9_@#.\-:]{2,64}$/u;          // Discord-ish
const SAFE_GAMEID = /^[A-Za-z0-9_\-.]{2,64}$/u;              // usual gamer tags
const SAFE_PHONE = /^[0-9+\-() ]{6,32}$/;                    // lenient, numeric-ish
const SAFE_ID = /^[A-Za-z0-9\- ]{3,64}$/;                    // passports / national ids
const SAFE_BANK = /^[A-Za-z0-9\- ]{3,64}$/;                  // account/partial ids, not full PANs

function cleanText(input: unknown, maxLen = 200, pattern: RegExp = SAFE_TEXT): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s || s.length > maxLen) return null;
  if (!pattern.test(s)) return null;
  if (/[<>]/.test(s) || /script:|javascript:/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

function cleanOptional(input: unknown, maxLen = 200, pattern: RegExp = SAFE_TEXT): string | null {
  // Empty string becomes null (explicit clear); otherwise validate
  if (input == null) return null;
  const s = String(input).trim();
  if (s === "") return null;
  return cleanText(s, maxLen, pattern);
}

function normalizeEmail(input: unknown): string | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) return null;
  return s;
}

function normalizeTricode(input: unknown): string | null {
  const s = String(input ?? "").trim().toUpperCase();
  if (!s) return null;
  // Exactly 3 letters A–Z only
  if (!/^[A-Z]{3}$/.test(s)) return null;
  return s;
}

function normalizePhone(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (!SAFE_PHONE.test(s)) return null;
  return s;
}

type SqlishError = {
  number?: number; errno?: number; code?: number;
  originalError?: { info?: { number?: number }; number?: number };
};
function getSqlErrorNumber(err: unknown): number | undefined {
  const e = err as SqlishError;
  return e?.number ?? e?.errno ?? e?.code ?? e?.originalError?.info?.number ?? e?.originalError?.number;
}

/* --------------------------- POST --------------------------- */

export async function POST(req: Request) {
  try {
    // Only accept JSON to reduce CSRF surface for credentialed requests
    const ctype = req.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) {
      return withCors(
        NextResponse.json({ ok: false, error: "Content-Type must be application/json" }, { status: 415 }),
      );
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Required
    const name = cleanText(body.name, 100, SAFE_TEXT);
    if (!name) {
      return withCors(NextResponse.json({ ok: false, error: "name is required" }, { status: 400 }));
    }

    const email = normalizeEmail(body.email);
    if (!email) {
      return withCors(NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 }));
    }

    // Optional but validated
    const teamName = cleanOptional(body.teamName, 120, SAFE_TEAM);
    const teamTricode = normalizeTricode(body.teamTricode);
    const discordId = cleanOptional(body.discordId, 64, SAFE_DISCORD);
    const gameId = cleanOptional(body.gameId, 64, SAFE_GAMEID);

    // Role
    const role = toRole(body.role);

    // Role-based requirement: LEADER/COACH require tricode
    if ((role === "LEADER" || role === "COACH") && !teamTricode) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles (3 letters A–Z)" },
          { status: 400 },
        ),
      );
    }

    // Sensitive/PII fields (all optional, tight formats)
    // NOTE: do not log these values.
    const passportId = cleanOptional(body.passportId, 64, SAFE_ID);
    const nationalId = cleanOptional(body.nationalId, 64, SAFE_ID);
    const bankDetails = cleanOptional(body.bankDetails, 64, SAFE_BANK);
    const phone = normalizePhone(body.phone);

    // Insert via AE-aware ODBC path (already parameterized)
    const insertedId = await insertTeamMemberAE({
      name,
      email,
      teamName: teamName ?? null,
      teamTricode: teamTricode ?? null,
      discordId: discordId ?? null,
      gameId: gameId ?? null,
      role,
      passportId: passportId ?? null,
      nationalId: nationalId ?? null,
      bankDetails: bankDetails ?? null,
      phone: phone ?? null,
    });

    // Fire-and-forget email notifications (no PII in logs)
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch((e) => console.error("Email send error (single)"));

    return withCors(NextResponse.json({ ok: true, id: insertedId }));
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Server error";
    const code = getSqlErrorNumber(err);

    if (code === 2627 && /Duplicate email/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email. Each email must be unique." }, { status: 409 }));
    }
    if (code === 2601 && /COACH/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Coach already exists for this team" }, { status: 409 }));
    }
    if (code === 2601 && /LEADER/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Team captain (leader) already exists for this team" }, { status: 409 }));
    }

    console.error("Teams Register POST AE error");
    return withCors(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
