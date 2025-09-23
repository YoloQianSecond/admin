// src/app/api/auth/request-otp/route.ts
import { NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/mail";

const ALLOWED_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

type OtpEntry = { code: string; expires: number; cooldownUntil: number };
const otpStore = new Map<string, OtpEntry>();

// Cooldown settings
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 min expiry
const OTP_COOLDOWN_MS = 60 * 1000; // 1 min before resend

export async function POST(req: Request) {
  const { email } = await req.json();
  const normalized = (email || "").toLowerCase();

  if (!ALLOWED_EMAILS.includes(normalized)) {
    return NextResponse.json({ message: "If the email is allowed, a code has been sent." });
  }

  const existing = otpStore.get(normalized);
  const now = Date.now();

  // Check cooldown → avoid spamming OTP requests
  if (existing && existing.cooldownUntil > now) {
    const secondsLeft = Math.ceil((existing.cooldownUntil - now) / 1000);
    return NextResponse.json(
      { error: `Please wait ${secondsLeft}s before requesting a new code.` },
      { status: 429 } // Too Many Requests
    );
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(normalized, {
    code,
    expires: now + OTP_EXPIRY_MS,
    cooldownUntil: now + OTP_COOLDOWN_MS,
  });

  // Send email asynchronously
  sendOtpEmail(normalized, code).catch((err) =>
    console.error("OTP email failed:", err)
  );

  console.log(`[otp] Sent code ${code} to ${normalized}`);
  return NextResponse.json({ message: "If the email is allowed, a code has been sent." });
}

// Export so verify-otp route can access the codes
export { otpStore };
