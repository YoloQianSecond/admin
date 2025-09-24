import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
export const runtime = "nodejs";
const prisma = new PrismaClient();

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const { id } = params;
  const item = await prisma.formatScheduleItem.findUnique({ where: { id } });
  if (!item?.imageData || !item.imageMime) return new NextResponse("Not Found", { status: 404 });
  return new NextResponse(item.imageData as any, {
    headers: { "Content-Type": item.imageMime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
