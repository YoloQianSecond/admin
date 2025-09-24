import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fileToBuffer } from "@/lib/fileToBuffer";
export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET() {
  const items = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, link: true, imageMime: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const link = String(form.get("link") || "").trim() || null;
  const image = form.get("image") as File | null;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!image) return NextResponse.json({ error: "Image is required" }, { status: 400 });

  const buffer = await fileToBuffer(image);
  const created = await prisma.promotion.create({
    data: { title, link, imageData: buffer, imageMime: image.type || "application/octet-stream" },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
