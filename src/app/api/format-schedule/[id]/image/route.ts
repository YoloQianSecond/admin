import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// helper: Uint8Array -> ArrayBuffer (exact slice)
function toArrayBuffer(u8: Uint8Array) {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const record = await prisma.formatScheduleItem.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true },
  });

  if (!record?.imageData || !record.imageMime) {
    return new Response("Not found", { status: 404 });
  }

  const ab = toArrayBuffer(record.imageData as unknown as Uint8Array);
  return new Response(ab, {
    headers: {
      "Content-Type": record.imageMime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
