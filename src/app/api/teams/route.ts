import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";
import { insertTeamMemberAE, readAllTeamMembers } from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

/* ---------------- VALIDATORS ---------------- */

type MemberRole = "LEADER" | "MEMBER" | "SUBSTITUTE" | "COACH";
const ROLES = new Set<MemberRole>(["LEADER", "MEMBER", "SUBSTITUTE", "COACH"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAFE_TEXT = /^[A-Za-z0-9 .,'!@#&()_\-/:?]+$/u;
const SAFE_TEAM = /^[A-Za-z0-9 .,'&()_\-]+$/u;
const SAFE_DISCORD = /^[A-Za-z0-9_@#.\-:]{2,64}$/u;
const SAFE_GAMEID = /^[A-Za-z0-9_\-.]{2,64}$/u;
const SAFE_PHONE = /^[0-9+\-() ]{6,32}$/;
const SAFE_ID = /^[A-Za-z0-9\- ]{3,64}$/;
const SAFE_BANK = /^[A-Za-z0-9\- ]{3,64}$/;

function cleanText(val: unknown, maxLen = 200, pattern: RegExp = SAFE_TEXT): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s.length > maxLen) return null;
  if (!pattern.test(s)) return null;
  if (/[<>]/.test(s) || /script:|javascript:/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

function cleanOptional(val: unknown, maxLen = 200, pattern: RegExp = SAFE_TEXT): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  return cleanText(s, maxLen, pattern);
}

function normalizeEmail(val: unknown): string | null {
  const s = String(val ?? "").trim().toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) return null;
  return s;
}

function normalizeTricode(val: unknown): string | null {
  const s = String(val ?? "").trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z]{3}$/.test(s)) return null;
  return s;
}

function normalizePhone(val: unknown): string | null {
  const s = String(val ?? "").trim();
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
  return (
    e?.number ??
    e?.errno ??
    e?.code ??
    e?.originalError?.info?.number ??
    e?.originalError?.number
  );
}

/* ---------------- GET ---------------- */

export async function GET() {
  try {
    const members = await readAllTeamMembers();
    return withCors(
      NextResponse.json(
        { ok: true, members },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      )
    );
  } catch (err) {
    console.error("Teams GET error");
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}

/* ---------------- POST ---------------- */

export async function POST(req: Request) {
  try {
    // Require JSON to reduce injection & CSRF surface
    const ctype = req.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) {
      return withCors(
        NextResponse.json({ ok: false, error: "Content-Type must be application/json" }, { status: 415 })
      );
    }

    const body = await req.json().catch(() => ({}));

    // Required: name, email
    const name = cleanText(body.name, 100, SAFE_TEXT);
    if (!name) {
      return withCors(NextResponse.json({ ok: false, error: "name is required" }, { status: 400 }));
    }

    const email = normalizeEmail(body.email);
    if (!email) {
      return withCors(NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 }));
    }

    // Optional fields with safe patterns
    const teamName = cleanOptional(body.teamName, 120, SAFE_TEAM);
    const teamTricode = normalizeTricode(body.teamTricode);
    const discordId = cleanOptional(body.discordId, 64, SAFE_DISCORD);
    const gameId = cleanOptional(body.gameId, 64, SAFE_GAMEID);

    // Role
    const roleRaw = String(body.role ?? "MEMBER").toUpperCase();
    const role = ROLES.has(roleRaw as MemberRole) ? (roleRaw as MemberRole) : "MEMBER";

    // LEADER/COACH rules
    if ((role === "LEADER" || role === "COACH") && !teamTricode) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles (3 letters A–Z)" },
          { status: 400 }
        )
      );
    }

    // Sensitive optional fields
    const passportId = cleanOptional(body.passportId, 64, SAFE_ID);
    const nationalId = cleanOptional(body.nationalId, 64, SAFE_ID);
    const bankDetails = cleanOptional(body.bankDetails, 64, SAFE_BANK);
    const phone = normalizePhone(body.phone);

    // Insert via AE (parameterized)
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

    // Async mails - no PII logged
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch(() => {});

    return withCors(NextResponse.json({ ok: true, id: insertedId }));
  } catch (err) {
    const code = getSqlErrorNumber(err);
    const msg = (err as Error)?.message || "Server error";

    if (code === 2627 && /Duplicate email/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email" }, { status: 409 }));
    }
    if (code === 2601 && /COACH/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Coach already exists" }, { status: 409 }));
    }
    if (code === 2601 && /LEADER/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Leader already exists" }, { status: 409 }));
    }

    console.error("Teams POST server error");
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}
