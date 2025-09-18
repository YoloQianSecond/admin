import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preflight for cross-origin requests
export async function OPTIONS() {
  return corsPreflight();
}

// List all published news
export async function GET() {
  const posts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: [{ date: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      entity: true,
      link: true,
      date: true,
      publishedAt: true,
      updatedAt: true,      // ✅ include this
      imageMime: true,
    },
  });

  return withCors(
    NextResponse.json({
      ok: true,
      posts: posts.map((p) => ({ ...p, hasImage: !!p.imageMime })),
    })
  );
}

// Create new post
export async function POST(req: Request) {
  const form = await req.formData();

  const title = String(form.get("title") ?? "");
  const description = form.get("description") ? String(form.get("description")) : "";
  const entity = form.get("entity") ? String(form.get("entity")) : null;
  const link = form.get("link") ? String(form.get("link")) : null;
  const publishNow = String(form.get("publishNow") ?? "true") === "true";
  const dateStr = form.get("date") ? String(form.get("date")) : "";
  const file = form.get("image") as File | null;

  if (!title) {
    return withCors(
      NextResponse.json({ ok: false, error: "title required" }, { status: 400 })
    );
  }

  let date: Date | null = null;
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  let imageData: Buffer | undefined;
  let imageMime: string | undefined;

  if (file && typeof file.arrayBuffer === "function") {
    const abuf = await file.arrayBuffer();
    imageData = Buffer.from(abuf);
    imageMime = file.type || "application/octet-stream";
  }

  const publishedAt = publishNow ? (date ?? new Date()) : null;

  const post = await prisma.newsPost.create({
    data: {
      title,
      description,
      entity,
      link,
      date,
      published: publishNow,
      publishedAt,
      imageData,
      imageMime: imageData ? imageMime : null,
    },
    select: { id: true },
  });

  return withCors(NextResponse.json({ ok: true, post }));
}
