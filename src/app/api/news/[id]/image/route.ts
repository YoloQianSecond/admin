// src/app/api/news/[id]/image/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preflight
export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const post = await prisma.newsPost.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true, updatedAt: true },
  });

  if (!post || !post.imageData || !post.imageMime) {
    return withCors(new NextResponse("Not found", { status: 404 }));
  }

  // Normalize to Uint8Array first
  const data = post.imageData as Buffer | Uint8Array;
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);

  // 🔧 Copy into a brand-new ArrayBuffer (guaranteed non-shared)
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);

  // Use Blob (valid BodyInit for NextResponse)
  const blob = new Blob([ab], { type: post.imageMime });

  return withCors(
    new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": post.imageMime,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Last-Modified": post.updatedAt.toUTCString(),
      },
    }),
  );
}
