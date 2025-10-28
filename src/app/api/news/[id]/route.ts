// src/app/api/news/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- Shared validation constants ----------
const SAFE_CHARS = /^[A-Za-z0-9 .,'!@#&()_\-/:?]+$/u;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const FORBIDDEN_EXT = new Set([
  "php","phtml","php3","php4","php5","phar","jsp","asp","aspx",
  "exe","sh","bat","cmd","js","mjs","cjs","pl","py"
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILENAME_REGEX = /^[A-Za-z0-9._-]+$/;

// ---------- Preflight ----------
export async function OPTIONS() {
  return corsPreflight();
}

// ---------- Utility ----------
function endsWithDotOrSpace(name: string) {
  return /[.\s]$/.test(name);
}

function cleanText(v: FormDataEntryValue | null, maxLen = 500): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > maxLen) return null;
  if (!SAFE_CHARS.test(s)) return null;
  if (/[<>]/.test(s) || /script:|javascript:/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

function parseUrlOptional(v: string | null): string | null | "INVALID" {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (!["http:", "https:"].includes(u.protocol)) return "INVALID";
    return u.toString();
  } catch {
    return "INVALID";
  }
}

function parseDateOptional(v: string | null): Date | null | "INVALID" {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "INVALID";
  return d;
}

function detectMime(u8: Uint8Array): string | null {
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
  if (
    u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
    u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a
  ) return "image/png";
  if (
    String.fromCharCode(...u8.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...u8.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (String.fromCharCode(...u8.slice(0, 6)).startsWith("GIF8")) return "image/gif";
  return null;
}

// ---------- PATCH ----------
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await req.formData();
  const has = (key: string) => form.has(key);

  // --- Validate text inputs only if present ---
  const titleSan = cleanText(has("title") ? form.get("title") : null, 200);
  const descSan = cleanText(has("description") ? form.get("description") : null, 2000);
  const entitySan = cleanText(has("entity") ? form.get("entity") : null, 100);

  if (has("title") && !titleSan) {
    return withCors(NextResponse.json({ error: "Invalid title" }, { status: 400 }));
  }
  if (has("description") && !descSan) {
    return withCors(NextResponse.json({ error: "Invalid description" }, { status: 400 }));
  }
  if (has("entity") && !entitySan) {
    return withCors(NextResponse.json({ error: "Invalid entity" }, { status: 400 }));
  }

  // --- Optional link ---
  let linkVal: string | null | undefined;
  if (has("link")) {
    const cleaned = cleanText(form.get("link"), 1000);
    if (cleaned === null) {
      return withCors(NextResponse.json({ error: "Invalid link" }, { status: 400 }));
    }
    const parsed = parseUrlOptional(cleaned);
    if (parsed === "INVALID") {
      return withCors(NextResponse.json({ error: "Invalid URL format" }, { status: 400 }));
    }
    linkVal = parsed ?? null; // parsed=string or null
  }

  // --- Optional date ---
  let dateVal: Date | null | undefined;
  if (has("date")) {
    const cleaned = cleanText(form.get("date"), 100);
    if (cleaned === null) {
      return withCors(NextResponse.json({ error: "Invalid date" }, { status: 400 }));
    }
    const parsed = parseDateOptional(cleaned);
    if (parsed === "INVALID") {
      return withCors(NextResponse.json({ error: "Invalid date format" }, { status: 400 }));
    }
    dateVal = parsed ?? null;
  }

  // --- Optional image ---
  const file = form.get("image") as File | null;
  let imageData: Buffer | undefined;
  let imageMime: string | undefined;

  if (file && typeof file.arrayBuffer === "function") {
    const name = file.name || "";
    const lower = name.toLowerCase();

    if (!name || !FILENAME_REGEX.test(name) || endsWithDotOrSpace(name)) {
      return withCors(NextResponse.json({ error: "Invalid filename" }, { status: 400 }));
    }

    const parts = lower.split(".");
    if (parts.length !== 2) {
      return withCors(NextResponse.json({ error: "Filename must contain only one extension" }, { status: 400 }));
    }

    const ext = parts.at(-1)!;
    if (!ALLOWED_EXT.has(ext) || FORBIDDEN_EXT.has(ext)) {
      return withCors(NextResponse.json({ error: "File extension not allowed" }, { status: 400 }));
    }

    if (file.size > MAX_FILE_SIZE) {
      return withCors(NextResponse.json({ error: "File too large" }, { status: 400 }));
    }

    const ab = await file.arrayBuffer();
    const u8 = new Uint8Array(ab);
    const detected = detectMime(u8);
    if (!detected || !ALLOWED_MIME.has(detected)) {
      return withCors(NextResponse.json({ error: "Invalid image content" }, { status: 400 }));
    }

    const extForMime: Record<string, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const expected = extForMime[detected];
    if (!(ext === expected || (ext === "jpg" && expected === "jpeg"))) {
      return withCors(NextResponse.json({ error: "Extension does not match image content" }, { status: 400 }));
    }

    imageData = Buffer.from(u8);
    imageMime = detected;
  }

  // --- Build update payload (ONLY set fields that passed validation) ---
  const data: Record<string, unknown> = {};

  if (has("title")) data.title = titleSan!;
  if (has("description")) data.description = descSan ?? "";
  if (has("entity")) data.entity = entitySan ?? null;
  if (has("link")) data.link = linkVal ?? null;
  if (has("date")) data.date = dateVal ?? null;
  if (imageData) {
    data.imageData = imageData;
    data.imageMime = imageMime!;
  }

  const updated = await prisma.newsPost.update({
    where: { id },
    data,
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

// ---------- DELETE ----------
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await prisma.newsPost.delete({ where: { id } });
  return withCors(NextResponse.json({ ok: true }));
}
