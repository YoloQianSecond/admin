// src/app/api/news/[id]/image/route.ts
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preflight
export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const post = await prisma.newsPost.findUnique({
    where: { id: params.id },
    select: { imageData: true, imageMime: true, updatedAt: true },
  });

  if (!post || !post.imageData || !post.imageMime) {
    return withCors(new Response("Not found", { status: 404 }));
  }

  // Prisma gives back a Buffer (Node.js) or Uint8Array, so normalize
  const data = post.imageData as Buffer | Uint8Array;
  const body = data instanceof Uint8Array ? data : new Uint8Array(data);

  return withCors(
    new Response(body, {
      headers: {
        "Content-Type": post.imageMime,
        // 🔒 Disable caching so updates always show immediately
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Last-Modified": post.updatedAt.toUTCString(),
      },
    })
  );
}
