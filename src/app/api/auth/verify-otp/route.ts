import { NextResponse } from "next/server";
import { otpStore } from "../request-otp/route";
import { signSession } from "@/lib/jwt";

const SESSION_EXPIRY = 60 * 60 * 4; // 4 hours in seconds

export async function POST(req: Request) {
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

  otpStore.delete(normalized);

  const token = await signSession({ sub: normalized, role: "admin" }, SESSION_EXPIRY);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "admin_session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_EXPIRY,
    sameSite: "lax",
  });
  return res;
}
