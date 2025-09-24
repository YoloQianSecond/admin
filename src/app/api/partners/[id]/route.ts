import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
export const runtime = "nodejs";
const prisma = new PrismaClient();
type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  await prisma.partner.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
