// src/app/api/teams/export/route.ts
// Purpose: Export TeamMember data as CSV for admin download (AE-safe via ODBC).

import { NextRequest, NextResponse } from "next/server";
import { readAllTeamMembers } from "@/lib/odbc-client";
import { requireAdminSession } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Optional: tiny same-origin check for cookie-auth POSTs ---

// Prefer POST (with CSRF/same-origin) for cookie-based auth.
// If you must keep GET, do the same checks in GET.
export async function POST(req: NextRequest) {
  try {
    // 🔒 Require a live, unrevoked admin session (checks revoked/expiry via getValidSession)
    await requireAdminSession();

    // 🔐 Basic CSRF hardening for cookie-auth flows
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: "CSRF_FORBIDDEN" }, { status: 403 });
    }

    const rows = await readAllTeamMembers();

    const header = [
      "id","createdAt","updatedAt","name","email",
      "teamName","teamTricode","discordId","gameId","igName","qualifierCountry","role",
    ];

    const toCell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows) {
      lines.push([
        r.id, r.createdAt, r.updatedAt, r.name ?? "", r.email ?? "",
        r.teamName ?? "", r.teamTricode ?? "", r.discordId ?? "",
        r.gameId ?? "", r.igName ?? "", r.qualifierCountry ?? "", r.role ?? "",
      ].map(toCell).join(","));
    }

    const csv = "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM for Excel

    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="team_members.csv"`,
        // prevent any proxy/browser caching of an authenticated download
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
      },
    });
    return res;
  } catch (err) {
    // If the session was revoked by logout, Repeater now gets 401 here
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

// If you still expose GET, mirror the same guard (but POST is recommended):
// export async function GET(req: NextRequest) { return POST(req); }
