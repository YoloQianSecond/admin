// src/app/api/auth/request-otp/route.ts
// Purpose: Accept an email, create an OTP if it matches ADMIN_EMAIL.
// Always return 200 with generic message to avoid user enumeration.


import { NextResponse } from "next/server";
import { createOtp } from "@/lib/otpStore";


export async function POST(req: Request) {
const { email } = await req.json();
const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
const okTarget = typeof email === "string" && email.toLowerCase() === adminEmail;


if (okTarget) {
const code = createOtp(adminEmail);
// DEV ONLY: log it instead of sending email
console.log("[DEV] OTP for", adminEmail, "=", code);
}


// Generic response regardless of match
return NextResponse.json({ ok: true, message: "If the email is allowed, a code has been sent." });
}