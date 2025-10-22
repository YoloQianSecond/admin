import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";

// ✅ ODBC AE-aware helpers
import { insertTeamMemberAE, readAllTeamMembers } from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

const emailRe = /\S+@\S+\.\S+/;

type MemberRole = "LEADER" | "MEMBER" | "SUBSTITUTE" | "COACH";
function isValidRole(role: string | null | undefined): role is MemberRole {
  const r = (role ?? "").toString().toUpperCase();
  return r === "LEADER" || r === "MEMBER" || r === "SUBSTITUTE" || r === "COACH";
}

/** 🔁 Helper: detect SQL duplicate-type numbers */
type SqlishError = {
  number?: number;
  errno?: number;
  code?: number;
  originalError?: {
    info?: { number?: number };
    number?: number;
  };
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

/* -------------------------------------------------------------------------- */
/*                                   GET                                      */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    // ✅ Use ODBC to decrypt AE fields like name/email
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
    console.error("Teams GET error:", err);
    return withCors(
      NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   POST                                     */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const teamName = (body.teamName ? String(body.teamName).trim() : "") || null;
    const teamTricode =
      (body.teamTricode ? String(body.teamTricode).trim().toUpperCase() : "") || null;
    const discordId = (body.discordId ? String(body.discordId).trim() : "") || null;
    const gameId = (body.gameId ? String(body.gameId).trim() : "") || null;

    const roleRaw = (body.role ?? "MEMBER").toString().toUpperCase();
    const role: MemberRole = isValidRole(roleRaw) ? (roleRaw as MemberRole) : "MEMBER";

    // ---- Validation ----
    if (!name) {
      return withCors(
        NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
      );
    }
    if (!email || !emailRe.test(email)) {
      return withCors(
        NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 })
      );
    }
    if (teamTricode && teamTricode.length !== 3) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode must be 3 chars" },
          { status: 400 }
        )
      );
    }
    if ((role === "LEADER" || role === "COACH") && !teamTricode) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles" },
          { status: 400 }
        )
      );
    }

    // ---- Insert (AE-aware) ----
    const insertedId = await insertTeamMemberAE({
      name,
      email,
      teamName,
      teamTricode,
      discordId,
      gameId,
      role,
      passportId: body.passportId ?? null,
      nationalId: body.nationalId ?? null,
      bankDetails: body.bankDetails ?? null,
      phone: body.phone ?? null,
    });

    // ---- Async mail notifications ----
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch((e) => console.error("Email send error (single):", e));

    return withCors(NextResponse.json({ ok: true, id: insertedId }));
  } catch (err: unknown) {
    const code = getSqlErrorNumber(err);
    const message = (err as Error)?.message || "Server error";

    // Handle specific messages for duplicates and roles
    if (code === 2627 && message.includes("Duplicate email")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Duplicate email. Each email must be unique." },
          { status: 409 }
        )
      );
    }
    if (code === 2601 && message.includes("COACH")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Coach already exists for this team" },
          { status: 409 }
        )
      );
    }
    if (code === 2601 && message.includes("LEADER")) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Team captain (leader) already exists for this team" },
          { status: 409 }
        )
      );
    }

    console.error("Teams POST error:", message, err);
    return withCors(
      NextResponse.json({ ok: false, error: message }, { status: 500 })
    );
  }
}
