// src/app/api/teams/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const id = params.id;
  const body = await req.json();
  try {
    const updated = await prisma.teamMember.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: String(body.email).toLowerCase() }),
        ...(body.teamName !== undefined && { teamName: body.teamName }),
        ...(body.teamTricode !== undefined && { teamTricode: body.teamTricode }),
        ...(body.discordId !== undefined && { discordId: body.discordId }),
        ...(body.gameId !== undefined && { gameId: body.gameId }),
        ...(body.isLeader !== undefined && { isLeader: !!body.isLeader }),
      },
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
        isLeader: true,
      },
    });
    return NextResponse.json({ ok: true, member: updated });
  } catch (err: any) {
    if (String(err?.code) === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Duplicate email. Each email must be unique." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Not found or server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const id = params.id;
  try {
    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}
