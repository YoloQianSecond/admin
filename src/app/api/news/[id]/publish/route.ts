// src/app/api/news/[id]/publish/route.ts


import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";


export async function POST(
req: Request,
{ params }: { params: { id: string } }
) {
const { id } = params;
const post = await prisma.newsPost.update({
where: { id },
data: { published: true, publishedAt: new Date() },
});
return NextResponse.json({ ok: true, post });
}