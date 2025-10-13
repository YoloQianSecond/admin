import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";


export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ await the promise
  await prisma.promotion.delete({ where: { id } });
  return NextResponse.json({ ok: true }, {
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
  });
}
