import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ Await the promise
  await prisma.partner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
