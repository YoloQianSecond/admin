// app/api/teams/route.ts

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

// Email must start with letter/digit; domain and TLD required
const EMAIL_RE = /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Tight patterns (alphanumeric with minimal extras)
const NAME_ALNUM_SP     = /^(?! )[A-Za-z0-9 ]+(?<! )$/u;  // letters/digits + spaces, no leading/trailing space
const TRICODE_RE        = /^[A-Z]{3}$/;                   // exactly 3 A–Z
const USER_ALNUM_UNDERS = /^[A-Za-z0-9_]{2,64}$/u;        // Discord/Game: letters/digits/underscore
const ID_ALNUM_SP       = /^[A-Za-z0-9 ]{3,64}$/u;        // passport/national/bank (no punctuation)
const SAFE_PHONE        = /^[0-9+\-() ]{6,32}$/;          // digits + limited symbols

// Required & must match
function requirePattern(val: unknown, pattern: RegExp, maxLen = 120, label = "field"): string {
  const s = String(val ?? "").trim();
  if (!s) throw new Error(`Valid ${label} is required`);
  if (s.length > maxLen) throw new Error(`${label} too long`);
  if (!pattern.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}

// Optional, but if present must match
function optionalPattern(val: unknown, pattern: RegExp, maxLen = 120, label = "field"): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  if (s.length > maxLen) throw new Error(`${label} too long`);
  if (!pattern.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}

// Require when key exists (even if empty). Optional if key absent.
function requireIfPresent(
  obj: Record<string, unknown>,
  key: string,
  pattern: RegExp,
  label: string,
  transform?: (s: string) => string
): string | null {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return null; // key not sent
  let s = String(obj[key] ?? "").trim();
  if (transform) s = transform(s);
  if (!pattern.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}

function normalizeEmail(val: unknown): string {
  const s = String(val ?? "").trim().toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) throw new Error("valid email is required");
  return s;
}

function normalizePhone(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  if (!SAFE_PHONE.test(s)) throw new Error("Invalid phone");
  return s;
}

type SqlishError = {
  number?: number; errno?: number; code?: number;
  originalError?: { info?: { number?: number }; number?: number };
};
function getSqlErrorNumber(err: unknown): number | undefined {
  const e = err as SqlishError;
  return e?.number ?? e?.errno ?? (typeof e?.code === "number" ? (e.code as number) : undefined) ?? e?.originalError?.info?.number ?? e?.originalError?.number;
}

/* --------------------------- POST --------------------------- */

export async function POST(req: Request) {
  try {
    // Only accept JSON to reduce CSRF surface
    const ctype = req.headers.get("content-type") || "";
    if (!ctype.toLowerCase().includes("application/json")) {
      return withCors(
        NextResponse.json({ ok: false, error: "Content-Type must be application/json" }, { status: 415 })
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Reject unknown keys so typos don’t bypass validation
    const allowed = new Set([
      "name",
      "email",
      "teamName",
      "teamTricode",
      "discordId",
      "gameId",
      "role",
      "passportId",
      "nationalId",
      "bankDetails",
      "phone",
    ]);
    const unknownKeys = Object.keys(body).filter((k) => !allowed.has(k));
    if (unknownKeys.length) {
      return withCors(
        NextResponse.json({ ok: false, error: `Unknown field(s): ${unknownKeys.join(", ")}` }, { status: 400 })
      );
    }

    // Required
    const name  = requirePattern(body.name, NAME_ALNUM_SP, 100, "name");
    const email = normalizeEmail(body.email);

    // Optional but strict when present
    const teamName    = optionalPattern(body.teamName, NAME_ALNUM_SP, 120, "teamName");

    // If client sends teamTricode, it MUST be 3 letters A–Z (uppercase enforced)
    const teamTricode = requireIfPresent(body, "teamTricode", TRICODE_RE, "teamTricode", (s) => s.toUpperCase());

    const discordId   = optionalPattern(body.discordId, USER_ALNUM_UNDERS, 64, "discordId");
    const gameId      = optionalPattern(body.gameId,    USER_ALNUM_UNDERS, 64, "gameId");

    // Role
    const role = toRole(body.role);

    // Role-based requirement: LEADER/COACH must include valid tricode in this POST
    if ((role === "LEADER" || role === "COACH") && !Object.prototype.hasOwnProperty.call(body, "teamTricode")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles (3 letters A–Z)" },
          { status: 400 }
        )
      );
    }

    // Sensitive/PII fields (optional)
    const passportId  = optionalPattern(body.passportId, ID_ALNUM_SP, 64, "passportId");
    const nationalId  = optionalPattern(body.nationalId, ID_ALNUM_SP, 64, "nationalId");
    const bankDetails = optionalPattern(body.bankDetails, ID_ALNUM_SP, 64, "bankDetails");
    const phone       = normalizePhone(body.phone);

    // Insert via parameterized ODBC path
    const insertedId = await insertTeamMemberAE({
      name,
      email,
      teamName:    teamName ?? null,
      teamTricode: teamTricode ?? null,
      discordId:   discordId ?? null,
      gameId:      gameId ?? null,
      role,
      passportId:  passportId ?? null,
      nationalId:  nationalId ?? null,
      bankDetails: bankDetails ?? null,
      phone:       phone ?? null,
    });

    // Fire-and-forget emails (no PII logged)
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch(() => {});

    return withCors(NextResponse.json({ ok: true, id: insertedId }));
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Server error";
    const code = getSqlErrorNumber(err);

    // Validation -> 400
    if (/^(Unknown field|Invalid |Valid .+ is required|.+ too long|teamTricode is required)/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: message }, { status: 400 }));
    }

    // Known DB constraints
    if (code === 2627 && /Duplicate email/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email. Each email must be unique." }, { status: 409 }));
    }
    if (code === 2601 && /COACH/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Coach already exists for this team" }, { status: 409 }));
    }
    if (code === 2601 && /LEADER/i.test(message)) {
      return withCors(NextResponse.json({ ok: false, error: "Team captain (leader) already exists for this team" }, { status: 409 }));
    }

    console.error("Teams Register POST AE error", err);
    return withCors(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
