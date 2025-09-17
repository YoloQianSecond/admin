// src/app/api/news/[id]/image/route.ts
// Stream DB-stored image bytes in a TS-safe way, regardless of Buffer/Uint8Array/ArrayBuffer.

import { prisma } from "@/lib/db";

// We’re using Prisma (Node driver), so run on Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const post = await prisma.newsPost.findUnique({
    where: { id: params.id },
    select: { imageData: true, imageMime: true, updatedAt: true },
  });

  if (!post || !post.imageData || !post.imageMime) {
    return new Response("Not found", { status: 404 });
  }

  // Normalize whatever Prisma returns into a Uint8Array that Response accepts.
  const data = post.imageData as unknown;

  let body: Uint8Array;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(data as any)) {
    // Handles Buffer and Uint8Array (both are views)
    const view = data as ArrayBufferView;
    body = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  } else {
    // Fallback if a raw ArrayBuffer-like is returned
    body = new Uint8Array(data as ArrayBuffer);
  }

  return new Response(body, {
    headers: {
      "Content-Type": post.imageMime,
      "Cache-Control": "public, max-age=3600",
      "Last-Modified": post.updatedAt.toUTCString(),
    },
  });
}
