// app/api/teams/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["LEADER", "MEMBER", "SUBSTITUTE", "COACH"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

type UpdateBody = {
  name?: string;
  email?: string;
  teamName?: string | null;
  teamTricode?: string | null;
  discordId?: string | null;
  gameId?: string | null;
  role?: Role | string;
};

type PrismaLikeError = { code?: string };

// PATCH (already had this)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await req.json()) as Partial<UpdateBody>;

  const data: Prisma.TeamMemberUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.email !== undefined) data.email = String(body.email).toLowerCase();
  if (body.teamName !== undefined) data.teamName = body.teamName ?? null;
  if (body.teamTricode !== undefined) data.teamTricode = body.teamTricode ?? null;
  if (body.discordId !== undefined) data.discordId = body.discordId ?? null;
  if (body.gameId !== undefined) data.gameId = body.gameId ?? null;

  if (body.role !== undefined) {
    const role = String(body.role).toUpperCase();
    if (!ALLOWED_ROLES.includes(role as Role)) {
      return NextResponse.json(
        { ok: false, error: `Invalid role. Use one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      );
    }
    data.role = role as Role;
  }

  try {
    const updated = await prisma.teamMember.update({
      where: { id },
      data,
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
        role: true,
      },
    });
    return NextResponse.json({ ok: true, member: updated });
  } catch (err: unknown) {
    if ((err as PrismaLikeError)?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Duplicate email. Each email must be unique." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Not found or server error" }, { status: 500 });
  }
}

// ✅ ADD THIS
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Not found
    if ((err as PrismaLikeError)?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Member not found." }, { status: 404 });
    }
    // FK constraint etc.
    return NextResponse.json({ ok: false, error: "Delete failed." }, { status: 500 });
  }
}
