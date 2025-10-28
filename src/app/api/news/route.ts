import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fileToBuffer } from "@/lib/fileToBuffer";

export const runtime = "nodejs";
const prisma = new PrismaClient();

const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

/**
 * Preflight for cross-origin requests
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
 * GET: list published news
 */
export async function GET() {
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
      posts: items.map((p) => ({
        ...p,
        hasImage: !!p.imageMime,
      })),
    },
    { headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
  );
}

/**
 * POST: create news post
 */
export async function POST(req: Request) {
  const form = await req.formData();

  // ---------- Helpers ----------
  function cleanText(v: FormDataEntryValue | null, maxLen = 500): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (s.length > maxLen) return null;

    const forbiddenPattern = /<|>|script:|javascript:/i;
    if (forbiddenPattern.test(s)) return null;

    const SAFE_CHARS = /^[A-Za-z0-9 .,'!@#&()_\-/:?]+$/u;
    if (!SAFE_CHARS.test(s)) return null;

    return s.replace(/\s+/g, " ");
  }

  const has = (k: string) => form.has(k);

  // ---------- Required: Title ----------
  const title = cleanText(form.get("title"), 200);
  if (!title) {
    return NextResponse.json(
      { error: "Invalid or missing title" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
    );
  }

  // ---------- Optional fields ----------
  const description = has("description")
    ? cleanText(form.get("description"), 2000)
    : null;
  const entity = has("entity")
    ? cleanText(form.get("entity"), 100)
    : null;

  if (has("description") && description === null) {
    return NextResponse.json(
      { error: "Invalid description" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
    );
  }

  if (has("entity") && entity === null) {
    return NextResponse.json(
      { error: "Invalid entity" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
    );
  }

  // ---------- Optional: Link ----------
  let link: string | null = null;
  if (has("link")) {
    const raw = String(form.get("link") ?? "").trim();
    if (raw === "") {
      link = null;
    } else {
      const cleaned = cleanText(raw, 1000);
      if (cleaned === null) {
        return NextResponse.json(
          { error: "Invalid link" },
          { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
        );
      }
      try {
        const url = new URL(cleaned);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad");
        link = url.toString();
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
        );
      }
    }
  }

  // ---------- Optional: Date ----------
  let date: Date | null = null;
  if (has("date")) {
    const cleaned = cleanText(form.get("date"), 100);
    if (cleaned && !isNaN(new Date(cleaned).getTime())) {
      date = new Date(cleaned);
    } else if (cleaned) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, Vary: "Origin" } }
      );
    }
  }

  // ---------- Publish flag ----------
  const publishNow = String(form.get("publishNow") ?? "true") === "true";
  const publishedAt = publishNow ? (date ?? new Date()) : null;

  // ---------- Image validation ----------
  const image = form.get("image") as File | null;
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const FORBIDDEN_EXT = new Set([
    "php","phtml","php3","php4","php5","phar","jsp","asp","aspx",
    "exe","sh","bat","cmd","js","mjs","cjs","pl","py"
  ]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;
  function endsWithDotOrSpace(n: string) { return /[.\s]$/.test(n); }

  function detectMime(u8: Uint8Array): string | null {
    if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return "image/png";
    if (String.fromCharCode(...u8.slice(0, 4)) === "RIFF" && String.fromCharCode(...u8.slice(8, 12)) === "WEBP")
      return "image/webp";
    if (String.fromCharCode(...u8.slice(0, 6)).startsWith("GIF8")) return "image/gif";
    return null;
  }

  let imageData: Buffer | undefined;
  let imageMime: string | null = null;

  if (image) {
    const name = image.name || "";
    if (!name || !FILENAME_REGEX.test(name) || endsWithDotOrSpace(name)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const parts = name.toLowerCase().split(".");
    if (parts.length < 2 || parts.length > 2) {
      return NextResponse.json({ error: "Double or missing extensions not allowed" }, { status: 400 });
    }
    const ext = parts.at(-1)!;
    if (!ALLOWED_EXT.has(ext) || FORBIDDEN_EXT.has(ext)) {
      return NextResponse.json({ error: "File extension not allowed" }, { status: 400 });
    }
    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const ab = await image.arrayBuffer();
    const u8 = new Uint8Array(ab);
    const detected = detectMime(u8);
    if (!detected || !ALLOWED_MIME.has(detected)) {
      return NextResponse.json({ error: "Invalid image content" }, { status: 400 });
    }

    const extForMime: Record<string, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const expected = extForMime[detected];
    if (!(ext === expected || (ext === "jpg" && expected === "jpeg"))) {
      return NextResponse.json({ error: "Extension mismatch" }, { status: 400 });
    }

    imageData = Buffer.from(u8);
    imageMime = detected;
  }

  // ---------- Save ----------
  const created = await prisma.newsPost.create({
    data: {
      title,
      description: description ?? "",
      entity,
      link,
      date,
      published: publishNow,
      publishedAt,
      imageData,
      imageMime,
    },
    select: { id: true },
  });

  return NextResponse.json(
    { id: created.id },
    {
      status: 201,
      headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        Vary: "Origin",
        Location: `/api/news/${created.id}`,
      },
    }
  );
}
