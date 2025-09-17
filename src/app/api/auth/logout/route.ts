// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
  res.cookies.set("session", "", { path: "/", httpOnly: true, maxAge: 0 });
  return res;
}
