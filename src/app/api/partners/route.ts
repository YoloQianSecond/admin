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

  // ✅ sanitize text inputs (prevent weird unicode, injections, etc.)
  const rawTitle = String(form.get("title") || "").trim();
  const rawLink = form.get("link") ? String(form.get("link")).trim() : null;
  const image = form.get("image") as File | null;

  if (!rawTitle) {
    return NextResponse.json(
      { error: "Title is required" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" },
      }
    );
  }

  // ✅ Basic allowed characters for title
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

  // ✅ Validate link if provided
  let link: string | null = null;
  if (rawLink) {
    try {
      const url = new URL(rawLink);
      link = url.toString();
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

  // -------- ✅ IMAGE VALIDATION -------- //
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const FORBIDDEN_EXT = new Set([
    "php","phtml","php3","php4","php5","phar","jsp","asp","aspx","exe","sh","bat","cmd","js","mjs","cjs","pl","py"
  ]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

  const filename = image.name || "";
  const lower = filename.toLowerCase();

  if (!filename || !FILENAME_REGEX.test(filename) || /[.\s]$/.test(filename)) {
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

  // ✅ Magic-byte content sniffing
  const ab = await image.arrayBuffer();
  const u8 = new Uint8Array(ab);

  function detectMime(u8: Uint8Array): string | null {
    if (u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
    if (
      u8.length > 8 &&
      u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
      u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a
    ) return "image/png";
    if (
      u8.length > 12 &&
      String.fromCharCode(u8[0],u8[1],u8[2],u8[3]) === "RIFF" &&
      String.fromCharCode(u8[8],u8[9],u8[10],u8[11]) === "WEBP"
    ) return "image/webp";
    if (
      u8.length > 6 &&
      String.fromCharCode(u8[0],u8[1],u8[2],u8[3],u8[4],u8[5]).startsWith("GIF8")
    ) return "image/gif";
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

  // ✅ Consistency check
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

  // ✅ store safe values
  const created = await prisma.partner.create({
    data: {
      title: rawTitle,
      link,
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
        "Location": `/api/partners/${created.id}`,
      },
    }
  );
}

