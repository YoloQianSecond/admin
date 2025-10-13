import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fileToBuffer } from "@/lib/fileToBuffer";
export const runtime = "nodejs";
const prisma = new PrismaClient();

const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";


export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}

export async function GET() {
  const items = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, link: true, imageMime: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(items, {
    headers: {
      "Access-Control-Allow-Origin": ORIGIN,
      "Vary": "Origin",
    },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const link = String(form.get("link") || "").trim() || null;
  const image = form.get("image") as File | null;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400,     headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
 });
  if (!image) return NextResponse.json({ error: "Image is required" }, { status: 400,     headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
 });

  const buffer = await fileToBuffer(image);
  const created = await prisma.partner.create({
    data: { title, link, imageData: buffer, imageMime: image.type || "application/octet-stream" },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id }, { status: 201, headers: {
      "Access-Control-Allow-Origin": ORIGIN,
      "Vary": "Origin",
      "Location": `/api/grandFinal/${created.id}`,
    },
  });
}
