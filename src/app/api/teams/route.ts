// app/api/teams/route.ts

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

// Email must start with letter/digit, then common localpart, with domain & TLD.
const EMAIL_RE = /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Field patterns
const NAME_ALNUM_SP     = /^(?! )[A-Za-z0-9 ]+(?<! )$/u;  // letters/digits + spaces, no leading/trailing space
const TRICODE_RE        = /^[A-Z]{3}$/;                   // exactly 3 A–Z
const USER_ALNUM_UNDERS = /^[A-Za-z0-9_]{2,64}$/u;        // letters/digits/underscore only
const ID_ALNUM_SP       = /^[A-Za-z0-9 ]{3,64}$/u;        // for passport/national/bank
const SAFE_PHONE        = /^[0-9+\-() ]{6,32}$/;

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
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return null; // key not sent at all
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

// SQL-ish error helper
type SqlishError = {
  number?: number; errno?: number; code?: number;
  originalError?: { info?: { number?: number }; number?: number };
};
function getSqlErrorNumber(err: unknown): number | undefined {
  const e = err as SqlishError;
  return (
    e?.number ??
    e?.errno ??
    (typeof e?.code === "number" ? (e.code as number) : undefined) ??
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
    console.error("Teams GET error", err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}

/* ---------------- POST ---------------- */

export async function POST(req: Request) {
  try {
    // Only accept JSON bodies
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
    const name = requirePattern(body.name, NAME_ALNUM_SP, 100, "name");
    const email = normalizeEmail(body.email);

    // Optional but strict when present
    const teamName = optionalPattern(body.teamName, NAME_ALNUM_SP, 120, "teamName");

    // ⬇️ If client sends teamTricode, it MUST be 3 letters A–Z (uppercase enforced)
    const teamTricode = requireIfPresent(body, "teamTricode", TRICODE_RE, "teamTricode", (s) =>
      s.toUpperCase()
    );

    const discordId = optionalPattern(body.discordId, USER_ALNUM_UNDERS, 64, "discordId");
    const gameId = optionalPattern(body.gameId, USER_ALNUM_UNDERS, 64, "gameId");

    // Role (default MEMBER)
    const roleRaw = String(body.role ?? "MEMBER").toUpperCase();
    const role: MemberRole = ROLES.has(roleRaw as MemberRole) ? (roleRaw as MemberRole) : "MEMBER";

    // If LEADER/COACH, tricode is REQUIRED (and if present, it's already validated)
    const tricodeKeyPresent = Object.prototype.hasOwnProperty.call(body, "teamTricode");
    if ((role === "LEADER" || role === "COACH") && !tricodeKeyPresent) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles (3 letters A–Z)" },
          { status: 400 }
        )
      );
    }

    // Sensitive optional fields
    const passportId = optionalPattern(body.passportId, ID_ALNUM_SP, 64, "passportId");
    const nationalId = optionalPattern(body.nationalId, ID_ALNUM_SP, 64, "nationalId");
    const bankDetails = optionalPattern(body.bankDetails, ID_ALNUM_SP, 64, "bankDetails");
    const phone = normalizePhone(body.phone);

    // Insert via parameterized API
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

    // Fire-and-forget emails
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch(() => {});

    return withCors(NextResponse.json({ ok: true, id: insertedId }));
  } catch (err) {
    const msg = (err as Error)?.message || "Server error";

    // Validation -> 400
    if (/^(Unknown field|Invalid |Valid .+ is required|.+ too long|teamTricode is required)/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: msg }, { status: 400 }));
    }

    const code = getSqlErrorNumber(err);
    if (code === 2627 && /Duplicate email/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email" }, { status: 409 }));
    }
    if (code === 2601 && /COACH/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Coach already exists" }, { status: 409 }));
    }
    if (code === 2601 && /LEADER/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: "Leader already exists" }, { status: 409 }));
    }

    console.error("Teams POST server error", err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}
