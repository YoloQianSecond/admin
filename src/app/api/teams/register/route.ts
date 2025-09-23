// src/app/api/teams/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

type MemberIn = {
  fullName: string;
  gameId: string;
  discordId: string;
  email: string;
  isLeader?: boolean;
};

export async function POST(req: Request) {
  try {
    const { teamName, teamTricode, teamLeader, members } = await req.json();

    // basic validation
    if (!teamName || typeof teamName !== "string") {
      return withCors(NextResponse.json({ ok: false, error: "teamName required" }, { status: 400 }));
    }
    if (!teamTricode || typeof teamTricode !== "string" || teamTricode.length !== 3) {
      return withCors(NextResponse.json({ ok: false, error: "teamTricode must be 3 chars" }, { status: 400 }));
    }
    if (!teamLeader || typeof teamLeader !== "object") {
      return withCors(NextResponse.json({ ok: false, error: "teamLeader required" }, { status: 400 }));
    }
    if (!Array.isArray(members) || members.length !== 4) {
      return withCors(NextResponse.json({ ok: false, error: "members must be an array of 4" }, { status: 400 }));
    }

    const normalize = (m: MemberIn, isLeader = false) => ({
      name: (m.fullName ?? "").trim(),
      email: (m.email ?? "").trim().toLowerCase(),
      discordId: (m.discordId ?? "").trim(),
      gameId: (m.gameId ?? "").trim(),
      teamName,
      teamTricode: teamTricode.toUpperCase(),
      isLeader,
    });

    const payload = [
      normalize(teamLeader, true),
      ...members.map((m: MemberIn) => normalize(m, false)),
    ];

    // Quick field checks
    for (const p of payload) {
      if (!p.name || !p.email || !p.discordId || !p.gameId) {
        return withCors(NextResponse.json({ ok: false, error: "All member fields required" }, { status: 400 }));
      }
    }

    // Insert all rows in a single transaction
    await prisma.$transaction([
      prisma.teamMember.createMany({ data: payload }),
    ]);

    return withCors(NextResponse.json({ ok: true }));
  } catch (err: unknown) {
    // If a duplicate email hits the unique constraint:
    if (String(err instanceof Error) === "P2002") {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email" }, { status: 409 }));
    }
    console.error("Register error:", err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}
