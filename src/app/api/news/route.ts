// src/app/api/news/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Do NOT send imageData in the list response (it’s big)
  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, slug: true, body: true,
      published: true, createdAt: true, imageMime: true
    }
  });
  // Add a convenience flag for the UI
  return NextResponse.json({
    ok: true,
    posts: posts.map(p => ({ ...p, hasImage: !!p.imageMime })),
  });
}

export async function POST(req: Request) {
  // Expect multipart/form-data for file uploads
  const form = await req.formData();
  const title = String(form.get("title") ?? "");
  const slug = String(form.get("slug") ?? "");
  const body = String(form.get("body") ?? "");
  const file = form.get("image") as File | null;

  if (!title || !slug || !body) {
    return NextResponse.json({ ok: false, error: "title, slug, body required" }, { status: 400 });
  }

  let imageData: Buffer | undefined;
  let imageMime: string | undefined;
  let imageSize: number | undefined;

  if (file && typeof file.arrayBuffer === "function") {
    // Basic guardrails (optional)
    const MAX = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX) {
      return NextResponse.json({ ok: false, error: "Image too large (max 5MB)" }, { status: 413 });
    }
    imageMime = file.type || "application/octet-stream";
    imageSize = file.size;
    const abuf = await file.arrayBuffer();
    imageData = Buffer.from(abuf);
  }

  const post = await prisma.newsPost.create({
    data: {
      title, slug, body,
      imageData,
      imageMime: imageData ? imageMime : null,
      imageSize: imageData ? imageSize : null,
    }
  });

  return NextResponse.json({ ok: true, post: { id: post.id } });
}
