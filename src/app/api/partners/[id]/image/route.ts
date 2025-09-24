import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
export const runtime = "nodejs";
const prisma = new PrismaClient();
type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const rec = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!rec?.imageData || !rec.imageMime) return new NextResponse("Not Found", { status: 404 });
  return new NextResponse(rec.imageData as any, {
    headers: { "Content-Type": rec.imageMime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
