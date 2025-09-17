// src/app/api/teams/route.ts
// Purpose: Basic list/create for TeamMember.


import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function GET() {
const members = await prisma.teamMember.findMany({ orderBy: { createdAt: "desc" } });
return NextResponse.json({ ok: true, members });
}


export async function POST(req: Request) {
const data = await req.json();
// Basic validation (add zod later)
if (!data?.name || !data?.email) {
return NextResponse.json({ ok: false, error: "name and email required" }, { status: 400 });
}
const member = await prisma.teamMember.create({ data });
return NextResponse.json({ ok: true, member });
}