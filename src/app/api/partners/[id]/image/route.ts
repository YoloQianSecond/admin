import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

// helper: Uint8Array/Buffer -> ArrayBuffer
function toArrayBuffer(u8: Uint8Array) {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const rec = await prisma.partner.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true },
  });

  if (!rec?.imageData || !rec.imageMime) {
    return new NextResponse("Not Found", { status: 404,
            headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
     });
  }

  // Prisma Bytes -> Uint8Array -> ArrayBuffer
  const ab = toArrayBuffer(rec.imageData as unknown as Uint8Array);

  // You can use Response or NextResponse; both accept ArrayBuffer
  return new NextResponse(ab, {
    headers: {
      "Content-Type": rec.imageMime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": ORIGIN,
      "Vary": "Origin",
    },
  });
}
