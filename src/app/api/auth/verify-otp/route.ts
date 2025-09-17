// src/app/api/auth/verify-otp/route.ts
// Purpose: Verify the submitted code; on success, set a signed session cookie.


import { NextResponse } from "next/server";
import { checkOtp } from "@/lib/otpStore";
import { signSession } from "@/lib/jwt";


export async function POST(req: Request) {
const { email, code } = await req.json();
const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();


if (typeof email !== "string" || typeof code !== "string") {
return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
}


if (email.toLowerCase() !== adminEmail) {
// Generic unauthorized (no enumeration)
return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 401 });
}


const res = checkOtp(adminEmail, code);
if (!res.ok) {
return NextResponse.json({ ok: false, error: "Invalid or expired code" }, { status: 401 });
}


const token = await signSession({ sub: adminEmail, role: "admin" });


const resp = NextResponse.json({ ok: true });
resp.cookies.set("session", token, {
httpOnly: true,
sameSite: "lax",
secure: process.env.NODE_ENV === "production",
path: "/",
// Optional: set maxAge to match JWT exp (8h in helper)
maxAge: 60 * 60 * 8,
});
return resp;
}