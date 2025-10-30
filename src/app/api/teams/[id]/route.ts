import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { updateTeamMemberAE, deleteTeamMemberById } from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

/* ---------------- VALIDATORS (same rules as POST) ---------------- */

const ALLOWED_ROLES = ["LEADER", "MEMBER", "SUBSTITUTE", "COACH"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

const EMAIL_RE = /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_ALNUM_SP     = /^(?! )[A-Za-z0-9 ]+(?<! )$/u;  // letters/digits + spaces, no leading/trailing space
const TRICODE_RE        = /^[A-Z]{3}$/;                   // exactly 3 A–Z
const USER_ALNUM_UNDERS = /^[A-Za-z0-9_]{2,64}$/u;        // letters/digits/underscore only
const ID_ALNUM_SP       = /^[A-Za-z0-9 ]{3,64}$/u;        // passport/national/bank
const SAFE_PHONE        = /^[0-9+\-() ]{6,32}$/;

function requirePattern(val: unknown, pattern: RegExp, maxLen = 120, label = "field"): string {
  const s = String(val ?? "").trim();
  if (!s) throw new Error(`Valid ${label} is required`);
  if (s.length > maxLen) throw new Error(`${label} too long`);
  if (!pattern.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}

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

function normalizeEmailOptional(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val ?? "").trim().toLowerCase();
  if (s === "") return null;
  if (s.length > 254 || !EMAIL_RE.test(s)) throw new Error("Invalid email");
  return s;
}

function normalizePhoneOptional(val: unknown): string | null {
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
  return (
    e?.number ??
    e?.errno ??
    (typeof e?.code === "number" ? (e.code as number) : undefined) ??
    e?.originalError?.info?.number ??
    e?.originalError?.number
  );
}

/* -------------------------------------------------------------------------- */
/*                               PATCH (Update)                               */
/* -------------------------------------------------------------------------- */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Only accept JSON
  const ctype = req.headers.get("content-type") || "";
  if (!ctype.toLowerCase().includes("application/json")) {
    return withCors(
      NextResponse.json({ ok: false, error: "Content-Type must be application/json" }, { status: 415 })
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return withCors(NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }));
  }

  // Reject unknown keys
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

  // If request is empty, 400
  if (Object.keys(body).length === 0) {
    return withCors(NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 }));
  }

  try {
    // Validate each provided field
    const name        = requireIfPresent(body, "name", NAME_ALNUM_SP, "name");
    const email       = normalizeEmailOptional(body.email);
    const teamName    = optionalPattern(body.teamName, NAME_ALNUM_SP, 120, "teamName");
    const teamTricode = requireIfPresent(body, "teamTricode", TRICODE_RE, "teamTricode", (s) => s.toUpperCase());
    const discordId   = optionalPattern(body.discordId, USER_ALNUM_UNDERS, 64, "discordId");
    const gameId      = optionalPattern(body.gameId,    USER_ALNUM_UNDERS, 64, "gameId");

    // Role (if present) must be valid
    let role: Role | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(body, "role")) {
      const r = String(body.role ?? "").toUpperCase();
      if (!ALLOWED_ROLES.includes(r as Role)) {
        return withCors(
          NextResponse.json(
            { ok: false, error: `Invalid role. Use one of: ${ALLOWED_ROLES.join(", ")}` },
            { status: 400 }
          )
        );
      }
      role = r as Role;
    }

    // If setting role to LEADER/COACH, require teamTricode in the same PATCH
    if ((role === "LEADER" || role === "COACH") && !Object.prototype.hasOwnProperty.call(body, "teamTricode")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode must be provided when setting role to LEADER or COACH (3 letters A–Z)" },
          { status: 400 }
        )
      );
    }

    // Sensitive optional fields
    const passportId  = optionalPattern(body.passportId, ID_ALNUM_SP, 64, "passportId");
    const nationalId  = optionalPattern(body.nationalId, ID_ALNUM_SP, 64, "nationalId");
    const bankDetails = optionalPattern(body.bankDetails, ID_ALNUM_SP, 64, "bankDetails");
    const phone       = normalizePhoneOptional(body.phone);

    // Build partial update object: undefined => "do not change"
    const updatePayload = {
      name:        name ?? undefined,
      email:       email ?? undefined,
      teamName:    teamName ?? undefined,
      teamTricode: teamTricode ?? undefined,
      discordId:   discordId ?? undefined,
      gameId:      gameId ?? undefined,
      role:        role ?? undefined,
      passportId:  passportId ?? undefined,
      nationalId:  nationalId ?? undefined,
      bankDetails: bankDetails ?? undefined,
      phone:       phone ?? undefined,
    };

    const updatedId = await updateTeamMemberAE(id, updatePayload);

    return withCors(NextResponse.json({ ok: true, id: updatedId }, { status: 200 }));
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "Server error";

    // Validation -> 400
    if (/^(Unknown field|Invalid |Valid .+ is required|.+ too long|No fields to update|teamTricode must be provided)/i.test(msg)) {
      return withCors(NextResponse.json({ ok: false, error: msg }, { status: 400 }));
    }

    // Known SQL constraint cases
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

    console.error("PATCH /teams/[id] error:", err);
    return withCors(NextResponse.json({ ok: false, error: msg }, { status: 500 }));
  }
}

/* -------------------------------------------------------------------------- */
/*                               DELETE (Remove)                              */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const count = await deleteTeamMemberById(id);
    if (count === 0) {
      return withCors(
        NextResponse.json({ ok: false, error: "Member not found." }, { status: 404 })
      );
    }
    return withCors(NextResponse.json({ ok: true }));
  } catch (err: unknown) {
    console.error("DELETE /teams/[id] error:", err);
    return withCors(
      NextResponse.json({ ok: false, error: "Delete failed." }, { status: 500 })
    );
  }
}
