// app/api/admin/whoami/route.ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // read cookies per request

export async function GET() {
  try {
    const session = await requireAdminSession();
    const res = NextResponse.json({ ok: true, who: session.userEmail });
    res.headers.set("Cache-Control", "no-store"); // don’t cache auth state
    return res;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
