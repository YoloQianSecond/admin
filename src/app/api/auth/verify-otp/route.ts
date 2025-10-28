// src/app/api/auth/verify-otp/route.ts
import { NextResponse, NextRequest } from "next/server";
import { otpStore } from "../request-otp/route";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

const SESSION_EXPIRY = 60 * 60 * 4; // 4 hours

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  const normalized = String(email || "").trim().toLowerCase();
  const entry = otpStore.get(normalized);
  const now = Date.now();

  if (!entry) {
    return NextResponse.json({ error: "No OTP found. Please request again." }, { status: 400 });
  }
  if (entry.expires < now) {
    otpStore.delete(normalized);
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }
  if (entry.code !== code) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  // ✅ Make OTP single-use
  otpStore.delete(normalized);

  // ✅ Create revocable server-side session
  const { id: sessionId } = await createSession(normalized, SESSION_EXPIRY, {
    ua: req.headers.get("user-agent") || undefined,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "admin_session",
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_EXPIRY,
    sameSite: "strict",
  });
  return res;
}
