// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("admin_session")?.value;

  // ✅ Revoke on the server so replayed responses fail
  await revokeSession(sessionId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "admin_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    sameSite: "strict",
  });
  return res;
}
