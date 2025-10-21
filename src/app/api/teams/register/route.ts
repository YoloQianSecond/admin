// src/app/api/teams/register/route.ts
import { NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/cors";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";

// AE-aware helpers
import {
  insertTeamMemberAE,
  existsRoleForTeamAE,
  isSqlDuplicateError,
  TRICODE_LEN,
} from "@/lib/ae-mssql";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const teamName = (body.teamName ? String(body.teamName).trim() : "") || null;
    const teamTricodeRaw = (body.teamTricode ? String(body.teamTricode).trim() : "") || "";
    const teamTricode = teamTricodeRaw ? teamTricodeRaw.toUpperCase() : null;
    const discordId = (body.discordId ? String(body.discordId).trim() : "") || null;
    const gameId = (body.gameId ? String(body.gameId).trim() : "") || null;

    const roleRaw = (body.role ?? "MEMBER").toString().toUpperCase();
    const role: MemberRole = isValidRole(roleRaw) ? (roleRaw as MemberRole) : "MEMBER";

    // ---- Validation ----
    if (!name) {
      return withCors(
        NextResponse.json({ ok: false, error: "name is required" }, { status: 400 }),
      );
    }
    if (!email || !emailRe.test(email)) {
      return withCors(
        NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 }),
      );
    }
    if (teamTricode && teamTricode.length !== TRICODE_LEN) {
      return withCors(
        NextResponse.json(
          { ok: false, error: `teamTricode must be ${TRICODE_LEN} chars` },
          { status: 400 },
        ),
      );
    }

    // ---- One coach per team (if tricode provided) ----
    if (role === "COACH" && teamTricode) {
      const existsCoach = await existsRoleForTeamAE(teamTricode, "COACH");
      if (existsCoach) {
        return withCors(
          NextResponse.json(
            { ok: false, error: "Coach already exists for this team" },
            { status: 409 },
          ),
        );
      }
    }

    // ---- One captain (LEADER) per team (if tricode provided) ----
    if (role === "LEADER" && teamTricode) {
      const existsLeader = await existsRoleForTeamAE(teamTricode, "LEADER");
      if (existsLeader) {
        return withCors(
          NextResponse.json(
            { ok: false, error: "Captain already exists for this team" },
            { status: 409 },
          ),
        );
      }
    }

    // ---- Insert via AE-aware path ----
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

    // ---- Emails (non-blocking) ----
    Promise.allSettled([
      sendRegistrationEmail(email, teamName ?? "", teamTricode ?? ""),
      sendAdminDigest([email], teamName ?? "", teamTricode ?? ""),
    ]).catch((e: unknown) => console.error("Email send error (single):", e));

    return withCors(NextResponse.json({ ok: true, member: { id: insertedId } }));
  } catch (err: unknown) {
    // Map SQL duplicate key to clean 409
    if (isSqlDuplicateError(err)) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Duplicate email. Each email must be unique." },
          { status: 409 },
        ),
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error("Teams Register POST AE error:", msg, err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}
