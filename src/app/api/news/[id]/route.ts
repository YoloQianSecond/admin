// src/app/api/news/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preflight
export async function OPTIONS() {
  return corsPreflight();
}

// Edit (PATCH)
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; // ⬅️ Next 15: await params

  const form = await req.formData();

  const title = form.get("title") ? String(form.get("title")) : undefined;
  const description = form.get("description") ? String(form.get("description")) : undefined;
  const entity = form.get("entity") ? String(form.get("entity")) : undefined;
  const link = form.get("link") ? String(form.get("link")) : undefined;
  const dateStr = form.get("date") ? String(form.get("date")) : undefined;
  const file = form.get("image") as File | null;

  let date: Date | undefined;
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

  const updated = await prisma.newsPost.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(entity !== undefined && { entity }),
      ...(link !== undefined && { link }),
      ...(date !== undefined && { date }),
      ...(imageData && { imageData, imageMime }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      entity: true,
      link: true,
      date: true,
      published: true,
      publishedAt: true,
      imageMime: true,
    },
  });

  return withCors(NextResponse.json({ ok: true, post: updated }));
}

// Delete (DELETE)
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; // ⬅️ Next 15: await params
  await prisma.newsPost.delete({ where: { id } });
  return withCors(NextResponse.json({ ok: true }));
}
