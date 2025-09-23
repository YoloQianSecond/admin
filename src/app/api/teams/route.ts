// src/app/api/teams/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const members = await prisma.teamMember.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,            // ✅ include for cache-busting on client
      name: true,
      email: true,
      teamName: true,
      teamTricode: true,
      discordId: true,
      gameId: true,
      isLeader: true,
    },
  });

  return new NextResponse(
    JSON.stringify({ ok: true, members }),
    {
      headers: {
        "Content-Type": "application/json",
        // ✅ prevent browser/proxy caching
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const created = await prisma.teamMember.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        teamName: body.teamName ?? null,
        teamTricode: body.teamTricode ?? null,
        discordId: body.discordId ?? null,
        gameId: body.gameId ?? null,
        isLeader: !!body.isLeader,
      },
    });
    return NextResponse.json({ ok: true, member: { id: created.id } });
  } catch (err: unknown) {
    if (String(err instanceof Error) === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Duplicate email. Each email must be unique." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
