import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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
  const items = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      link: true,
      country: true,      // 👈 now included in response
      imageMime: true,
      createdAt: true,
      updatedAt: true,
    },
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

  // —— sanitize text inputs ——
  const rawTitle = String(form.get("title") || "").trim();
  const rawLink = form.get("link") ? String(form.get("link")).trim() : null;
  const image = form.get("image") as File | null;

  // NEW: country from form (optional)
  const rawCountry = String(form.get("country") || "").trim();

  if (!rawTitle) {
    return NextResponse.json(
      { error: "Title is required" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  // allow letters, numbers, spaces and some punctuation; tweak if you need more
  const SAFE_TEXT = /^[A-Za-z0-9 .,'!@#&()_-]+$/u;
  if (!SAFE_TEXT.test(rawTitle)) {
    return NextResponse.json(
      { error: "Title contains disallowed characters" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  // —— validate link (optional) ——
  let link: string | null = null;
  if (rawLink) {
    try {
      const u = new URL(rawLink);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad scheme");
      link = u.toString();
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
        }
      );
    }
  }

  if (!image) {
    return NextResponse.json(
      { error: "Image is required" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  // —— validate / normalize country ——
  // DB type is String, so we just keep it safe & consistent
  let country = "GLOBAL";
  if (rawCountry) {
    // normalize to uppercase, trim, and restrict to simple pattern
    const normalized = rawCountry.toUpperCase();
    const COUNTRY_SAFE = /^[A-Z0-9_-]{2,32}$/; // e.g. "GLOBAL", "MY", "TH", "SEA"
    if (!COUNTRY_SAFE.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid country value" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
        }
      );
    }
    country = normalized;
  }

  // —— image validation (whitelist + magic bytes + size + filename) ——
  const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const FORBIDDEN_EXT = new Set([
    "php",
    "phtml",
    "php3",
    "php4",
    "php5",
    "phar",
    "jsp",
    "asp",
    "aspx",
    "exe",
    "sh",
    "bat",
    "cmd",
    "js",
    "mjs",
    "cjs",
    "pl",
    "py",
  ]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

  const name = image.name || "";
  const lower = name.toLowerCase();

  if (!name || !FILENAME_REGEX.test(name) || /[.\s]$/.test(name)) {
    return NextResponse.json(
      { error: "Invalid filename" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  const parts = lower.split(".");
  if (parts.length !== 2) {
    return NextResponse.json(
      { error: "Double extensions or missing extension not allowed" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  const ext = parts[1];
  if (!ALLOWED_EXT.has(ext) || FORBIDDEN_EXT.has(ext)) {
    return NextResponse.json(
      { error: "File extension not allowed" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  const ab = await image.arrayBuffer();
  const u8 = new Uint8Array(ab);

  // magic-byte detector
  function detectMime(b: Uint8Array): string | null {
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
    )
      return "image/png";
    if (
      b.length > 12 &&
      String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
      String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
    )
      return "image/webp";
    if (
      b.length > 6 &&
      String.fromCharCode(
        b[0],
        b[1],
        b[2],
        b[3],
        b[4],
        b[5]
      ).startsWith("GIF8")
    )
      return "image/gif";
    return null;
  }

  const detected = detectMime(u8);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    return NextResponse.json(
      { error: "Invalid or unsupported image content" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  const extForMime: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const expected = extForMime[detected];
  if (!(ext === expected || (ext === "jpg" && expected === "jpeg"))) {
    return NextResponse.json(
      { error: "File extension does not match image content" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  // —— persist using detected mime + country ——
  const created = await prisma.promotion.create({
    data: {
      title: rawTitle,
      link,
      country,                    // 👈 now stored
      imageData: Buffer.from(u8),
      imageMime: detected,
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
        // 🔧 correct path
        "Location": `/api/promotions/${created.id}`,
      },
    }
  );
}
