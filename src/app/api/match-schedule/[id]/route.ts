import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();
type Params = { params: { id: string } };

// (optional) GET one
export async function GET(_: Request, { params }: Params) {
  try {
    const rec = await prisma.matchSchedule.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, liveLink: true, matchDate: true, createdAt: true, updatedAt: true },
    });
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rec);
  } catch (err) {
    console.error("GET /match-schedule/:id failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const result = await prisma.matchSchedule.deleteMany({ where: { id: params.id } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /match-schedule/:id failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
