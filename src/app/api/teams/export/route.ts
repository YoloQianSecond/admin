// src/app/api/teams/export/route.ts
// Purpose: Export TeamMember data as CSV for admin download.

import { prisma } from "@/lib/db";

// Optional: avoid any caching of the CSV
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.teamMember.findMany({
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "id",
    "createdAt",
    "name",
    "email",
    "teamName",
    "discordId",
    "gameId",
    "passportId",
    "nationalId",
    "bankDetails",
    "phone",
  ];

  // Quote a cell if it contains a comma, quote, or newline; escape quotes by doubling.
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
        r.createdAt.toISOString(),
        r.name,
        r.email,
        r.teamName ?? "",
        r.discordId ?? "",
        r.gameId ?? "",
        r.passportId ?? "",
        r.nationalId ?? "",
        r.bankDetails ?? "",
        r.phone ?? "",
      ].map(toCell).join(",")
    );
  }

  // Prepend BOM for Excel and join with CRLF
  const csv = "\uFEFF" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="team_members.csv"',
      "Cache-Control": "no-store",
    },
  });
}
