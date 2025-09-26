import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

// GET one
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ Await the Promise
    const rec = await prisma.matchSchedule.findUnique({
      where: { id },
      select: { id: true, title: true, liveLink: true, matchDate: true, createdAt: true, updatedAt: true },
    });
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rec);
  } catch (err) {
    console.error("GET /match-schedule/:id failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ Await the Promise
    const result = await prisma.matchSchedule.deleteMany({ where: { id } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /match-schedule/:id failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
