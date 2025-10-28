import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { fileToBuffer } from "@/lib/fileToBuffer";

export const runtime = "nodejs";
const prisma = new PrismaClient();

// adjust for dev/prod as needed
// const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const ORIGIN = process.env.CORS_ORIGIN ?? "*";


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
  const items = await prisma.grandFinal.findMany({
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

  // --- Sanitize text inputs ---
  const rawTitle = String(form.get("title") || "").trim();
  const rawLink = form.get("link") ? String(form.get("link")).trim() : null;
  const image = form.get("image") as File | null;

  // Title required
  if (!rawTitle) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // Title safe characters
  const SAFE_TEXT = /^[A-Za-z0-9 .,'!@#&()_-]+$/u;
  if (!SAFE_TEXT.test(rawTitle)) {
    return NextResponse.json(
      { error: "Title contains disallowed characters" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // Optional link validation
  let link: string | null = null;
  if (rawLink) {
    try {
      const url = new URL(rawLink);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid scheme");
      link = url.toString();
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
      );
    }
  }

  if (!image) {
    return NextResponse.json(
      { error: "Image is required" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // ---------- IMAGE VALIDATION ----------
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const FORBIDDEN_EXT = new Set([
    "php","phtml","php3","php4","php5","phar","jsp","asp","aspx","exe","sh","bat","cmd","js","mjs","cjs","pl","py"
  ]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

  const filename = image.name || "";
  const lower = filename.toLowerCase();

  if (!filename || !FILENAME_REGEX.test(filename) || /[.\s]$/.test(filename)) {
    return NextResponse.json(
      { error: "Invalid filename" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  const parts = lower.split(".");
  if (parts.length !== 2) {
    return NextResponse.json(
      { error: "Double extensions or missing extension not allowed" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  const ext = parts[1];
  if (!ALLOWED_EXT.has(ext) || FORBIDDEN_EXT.has(ext)) {
    return NextResponse.json(
      { error: "File extension not allowed" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // ---------- Magic-byte content sniffing ----------
  const ab = await image.arrayBuffer();
  const u8 = new Uint8Array(ab);

  function detectMime(bytes: Uint8Array): string | null {
    if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length > 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) return "image/png";
    if (bytes.length > 12 &&
      String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]) === "RIFF" &&
      String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11]) === "WEBP"
    ) return "image/webp";
    if (bytes.length > 6 &&
      String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3],bytes[4],bytes[5]).startsWith("GIF8")
    ) return "image/gif";
    return null;
  }

  const detected = detectMime(u8);
  if (!detected || !ALLOWED_MIME.has(detected)) {
    return NextResponse.json(
      { error: "Invalid or unsupported image content" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
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
      { status: 400, headers: { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } }
    );
  }

  // ---------- Safe DB write ----------
  const created = await prisma.grandFinal.create({
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
        "Location": `/api/grandFinal/${created.id}`,
      },
    }
  );
}
