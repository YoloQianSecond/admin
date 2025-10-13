import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { corsPreflight, withCors } from "@/lib/cors"; // adjust path

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function OPTIONS() {
  return corsPreflight();
}

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
      select: { id: true, title: true, liveLink: true, matchDate: true, createdAt: true, updatedAt: true },
    });

    return withCors(NextResponse.json(items));
  } catch (err) {
    console.error("GET /match-schedule failed:", err);
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let title = "", dateStr = "", liveLink: string | null = null;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      title = String(form.get("title") || "").trim();
      dateStr = String(form.get("date") || "").trim();
      const link = String(form.get("liveLink") || "").trim();
      liveLink = link || null;
    } else {
      const body = await req.json().catch(() => ({}));
      title = String(body.title || "").trim();
      dateStr = String(body.date || "").trim();
      liveLink = body.liveLink ? String(body.liveLink).trim() : null;
    }

    if (!title) return withCors(NextResponse.json({ error: "Title is required" }, { status: 400 }));
    if (!dateStr) return withCors(NextResponse.json({ error: "Date is required (yyyy-mm-dd)" }, { status: 400 }));

    const matchDate = new Date(`${dateStr}T00:00:00`);
    if (isNaN(matchDate.getTime())) {
      return withCors(NextResponse.json({ error: "Invalid date format. Use yyyy-mm-dd." }, { status: 400 }));
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
