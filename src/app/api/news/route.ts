import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fileToBuffer } from "@/lib/fileToBuffer";

export const runtime = "nodejs";
const prisma = new PrismaClient();

const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

/**
 * Preflight for cross-origin requests (same style as promotion)
 */
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

/**
 * GET: list published news (plain array response + CORS headers,
 * mirroring the promotion route’s shape/headers)
 */
  export async function GET() {
  // inside GET()
    const items = await prisma.newsPost.findMany({
      where: { published: true },
      orderBy: [{ date: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        entity: true,
        link: true,
        date: true,
        published: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        imageMime: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        posts: items.map((p) => ({ ...p, hasImage: !!p.imageMime })),
      },
      { headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

/**
 * POST: create news post (promotion-like flow, with news fields).
 * - Title required
 * - Image OPTIONAL (keep parity with your original news endpoint)
 *   -> To make image required like promotion, uncomment the check below.
 */
export async function POST(req: Request) {
  const form = await req.formData();

  const title = String(form.get("title") || "").trim();
  const description = (form.get("description") ? String(form.get("description")) : "").trim();
  const entity = form.get("entity") ? String(form.get("entity")) : null;
  const link = form.get("link") ? String(form.get("link")) : null;
  const publishNow = String(form.get("publishNow") ?? "true") === "true";
  const dateStr = form.get("date") ? String(form.get("date")) : "";
  const image = form.get("image") as File | null;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // If you want to enforce image like the promotion route, uncomment:
  // if (!image) {
  //   return NextResponse.json(
  //     { error: "Image is required" },
  //     { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
  //   );
  // }

  // Parse optional date
  let date: Date | null = null;
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  // Handle optional image
  let imageData: Buffer | undefined;
  let imageMime: string | null = null;
  if (image) {
    const buffer = await fileToBuffer(image);
    imageData = buffer;
    imageMime = image.type || "application/octet-stream";
  }

  const publishedAt = publishNow ? (date ?? new Date()) : null;

  const created = await prisma.newsPost.create({
    data: {
      title,
      description,
      entity,
      link,
      date,
      published: publishNow,
      publishedAt,
      imageData,
      imageMime, // null if no image
    },
    select: { id: true },
  });

  return NextResponse.json(
    { id: created.id },
    {
      status: 201,
      headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        "Vary": "Origin",
        "Location": `/api/news/${created.id}`,
      },
    }
  );
}
