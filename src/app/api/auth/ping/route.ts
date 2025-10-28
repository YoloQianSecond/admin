// app/api/auth/ping/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getValidSession, touchSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDLE = Number(process.env.SESSION_IDLE_SECONDS ?? 900);

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("admin_session")?.value;
  const session = await getValidSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  await touchSession(sessionId!, IDLE);

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set({
    name: "admin_session",
    value: sessionId!,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IDLE,           // keep cookie aligned with idle timeout
    sameSite: "strict",
  });
  return res;
}
