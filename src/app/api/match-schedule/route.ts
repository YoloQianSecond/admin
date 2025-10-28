import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { corsPreflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function OPTIONS() {
  return corsPreflight();
}

/* ---------------------- Helpers ---------------------- */

const SAFE_CHARS = /^[A-Za-z0-9 .,'!@#&()_\-/:?]+$/u;

function cleanText(input: unknown, maxLen = 200): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s || s.length > maxLen) return null;
  if (!SAFE_CHARS.test(s)) return null;
  if (/[<>]/.test(s) || /script:|javascript:/i.test(s)) return null;
  return s.replace(/\s+/g, " ");
}

/** Strict YYYY-MM-DD parser; rejects 2025-13-40, etc. */
function parseYMD(dateStr: string): Date | "INVALID" {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return "INVALID";
  const [_, ys, ms, ds] = m;
  const y = Number(ys), mo = Number(ms), d = Number(ds);
  // Basic range checks
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "INVALID";
  // Construct and verify
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== mo ||
    dt.getUTCDate() !== d
  ) return "INVALID";
  return dt;
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

/* ---------------------- GET ---------------------- */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");
    const now = new Date();

    const where =
      filter === "upcoming" ? { matchDate: { gte: now } } :
      filter === "completed" ? { matchDate: { lt: now } } :
      {};

    const items = await prisma.matchSchedule.findMany({
      where,
      orderBy: { matchDate: "desc" },
      select: {
        id: true,
        title: true,
        liveLink: true,
        matchDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return withCors(NextResponse.json(items));
  } catch (err) {
    console.error("GET /match-schedule failed:", err);
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}

/* ---------------------- POST ---------------------- */

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let titleRaw: unknown, dateRaw: unknown, liveLinkRaw: unknown;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      titleRaw   = form.get("title");
      dateRaw    = form.get("date");
      liveLinkRaw = form.get("liveLink");
    } else {
      const body = await req.json().catch(() => ({}));
      titleRaw   = body.title;
      dateRaw    = body.date;
      liveLinkRaw = body.liveLink;
    }

    // ---- Validate title ----
    const title = cleanText(titleRaw, 200);
    if (!title) {
      return withCors(NextResponse.json({ error: "Invalid or missing title" }, { status: 400 }));
    }

    // ---- Validate date (YYYY-MM-DD) ----
    const dateStr = cleanText(dateRaw, 10); // "YYYY-MM-DD" is 10 chars
    if (!dateStr) {
      return withCors(NextResponse.json({ error: "Date is required (YYYY-MM-DD)" }, { status: 400 }));
    }
    const parsedDate = parseYMD(dateStr);
    if (parsedDate === "INVALID") {
      return withCors(NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 }));
    }
    const matchDate = parsedDate; // UTC midnight

    // ---- Validate liveLink (optional) ----
    let liveLink: string | null = null;
    if (liveLinkRaw !== undefined && liveLinkRaw !== null) {
      const cleaned = cleanText(liveLinkRaw, 1000);
      if (cleaned === null) {
        // If provided but not empty, it must be valid; empty string clears it.
        const str = String(liveLinkRaw).trim();
        if (str !== "") {
          return withCors(NextResponse.json({ error: "Invalid liveLink" }, { status: 400 }));
        }
      } else {
        const parsed = parseUrlOptional(cleaned);
        if (parsed === "INVALID") {
          return withCors(NextResponse.json({ error: "Invalid URL format for liveLink" }, { status: 400 }));
        }
        liveLink = parsed; // string or null
      }
    }

    const created = await prisma.matchSchedule.create({
      data: { title, matchDate, liveLink },
      select: { id: true },
    });

    return withCors(NextResponse.json({ id: created.id }, { status: 201 }));
  } catch (err) {
    console.error("POST /match-schedule failed:", err);
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}
