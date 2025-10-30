// app/api/auth/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getValidSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("admin_session")?.value;
  const s = await getValidSession(sid); // ❗ do not call touch/extend here
  if (!s) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
