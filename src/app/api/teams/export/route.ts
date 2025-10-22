// src/app/api/teams/export/route.ts
// Purpose: Export TeamMember data as CSV for admin download (AE-safe via ODBC).

import { readAllTeamMembers } from "@/lib/odbc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // ✅ Use AE-aware ODBC instead of Prisma
  const rows = await readAllTeamMembers();

  const header = [
    "id",
    "createdAt",
    "updatedAt",
    "name",
    "email",
    "teamName",
    "teamTricode",
    "discordId",
    "gameId",
    "role",
  ];

  // Escape commas/quotes/newlines for CSV compliance
  const toCell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [];
  lines.push(header.join(","));

  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt,
        r.updatedAt,
        r.name ?? "",
        r.email ?? "",
        r.teamName ?? "",
        r.teamTricode ?? "",
        r.discordId ?? "",
        r.gameId ?? "",
        r.role ?? "",
      ]
        .map(toCell)
        .join(",")
    );
  }

  // Add UTF-8 BOM for Excel compatibility
  const csv = "\uFEFF" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="team_members.csv"',
      "Cache-Control": "no-store",
    },
  });
}
