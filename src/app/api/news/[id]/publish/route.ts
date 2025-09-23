// src/app/api/news/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ Next 15: await params

  const post = await prisma.newsPost.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });

  return NextResponse.json({ ok: true, post });
}
