// src/app/api/teams/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma, MemberRole } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const members = await prisma.teamMember.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      name: true,
      email: true,
      teamName: true,
      teamTricode: true,
      discordId: true,
      gameId: true,
      role: true,              // 👈 use enum role now
    },
  });

  return new NextResponse(JSON.stringify({ ok: true, members }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  // normalize & basic validation
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const teamName = String(body.teamName ?? "").trim() || null;
  const teamTricode = body.teamTricode ? String(body.teamTricode).trim().toUpperCase() : null;
  const discordId = String(body.discordId ?? "").trim() || null;
  const gameId = String(body.gameId ?? "").trim() || null;
  const role = (String(body.role ?? "MEMBER").toUpperCase() as MemberRole) || "MEMBER";

  if (!name || !email) {
    return NextResponse.json({ ok: false, error: "name and email are required" }, { status: 400 });
  }
  if (!["LEADER", "MEMBER", "SUBSTITUTE", "COACH"].includes(role)) {
    return NextResponse.json({ ok: false, error: "invalid role" }, { status: 400 });
  }
  if (teamTricode && teamTricode.length !== 3) {
    return NextResponse.json({ ok: false, error: "teamTricode must be 3 chars" }, { status: 400 });
  }

  // Optional guardrails (recommended):
  // 1) Disallow >1 coach per tricode
  if (role === "COACH" && teamTricode) {
    const existingCoach = await prisma.teamMember.findFirst({
      where: { teamTricode, role: "COACH" },
      select: { id: true },
    });
    if (existingCoach) {
      return NextResponse.json(
        { ok: false, error: "Coach already exists for this team" },
        { status: 409 }
      );
    }
  }

  // 2) (Optional) Disallow >1 leader per tricode — uncomment if you want this on manual admin adds
  // if (role === "LEADER" && teamTricode) {
  //   const existingLeader = await prisma.teamMember.findFirst({
  //     where: { teamTricode, role: "LEADER" },
  //     select: { id: true },
  //   });
  //   if (existingLeader) {
  //     return NextResponse.json(
  //       { ok: false, error: "Leader already exists for this team" },
  //       { status: 409 }
  //     );
  //   }
  // }

  try {
    const created = await prisma.teamMember.create({
      data: {
        name,
        email,
        teamName,
        teamTricode,
        discordId,
        gameId,
        role, // 👈 persist the enum
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, member: { id: created.id } });
  } catch (err: any) {
    // Proper Prisma unique violation detection
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Duplicate email. Each email must be unique." },
        { status: 409 }
      );
    }
    console.error("Teams POST error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
