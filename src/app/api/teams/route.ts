// src/app/api/teams/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";

// AE-aware helpers
import {
  insertTeamMemberAE,
  isSqlDuplicateError,
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

export async function GET() {
  try {
    // ⚠️ Do not select AE columns (name, email, passportId, etc.) with Prisma.
    const members = await prisma.teamMember.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        teamName: true,
        teamTricode: true,
        discordId: true,
        gameId: true,
        role: true,
      },
    });

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
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}

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
      return withCors(NextResponse.json({ ok: false, error: "name is required" }, { status: 400 }));
    }
    if (!email || !emailRe.test(email)) {
      return withCors(
        NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 })
      );
    }
    if (teamTricode && teamTricode.length !== 3) {
      return withCors(
        NextResponse.json({ ok: false, error: "teamTricode must be 3 chars" }, { status: 400 })
      );
    }

    // Leaders/Coaches must specify teamTricode so we can enforce uniqueness
    if ((role === "LEADER" || role === "COACH") && !teamTricode) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "teamTricode is required for LEADER and COACH roles" },
          { status: 400 }
        )
      );
    }

    // ---- Team-level constraints (safe with Prisma: non-AE columns) ----
    if (role === "COACH" && teamTricode) {
      const existingCoach = await prisma.teamMember.findFirst({
        where: { teamTricode, role: "COACH" },
        select: { id: true },
      });
      if (existingCoach) {
        return withCors(
          NextResponse.json(
            { ok: false, error: "Coach already exists for this team" },
            { status: 409 }
          )
        );
      }
    }

    if (role === "LEADER" && teamTricode) {
      const existingLeader = await prisma.teamMember.findFirst({
        where: { teamTricode, role: "LEADER" },
        select: { id: true },
      });
      if (existingLeader) {
        return withCors(
          NextResponse.json(
            { ok: false, error: "Team captain (leader) already exists for this team" },
            { status: 409 }
          )
        );
      }
    }

    // ---- Insert via AE-aware path (handles encrypted columns) ----
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
    ]).catch((e) => console.error("Email send error (single):", e));

    return withCors(NextResponse.json({ ok: true, member: { id: insertedId } }));
  } catch (err: unknown) {
    if (isSqlDuplicateError(err)) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Duplicate email. Each email must be unique." },
          { status: 409 }
        )
      );
    }
    console.error("Teams POST error:", err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}
