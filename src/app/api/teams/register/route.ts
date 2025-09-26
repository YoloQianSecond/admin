// src/app/api/teams/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withCors, corsPreflight } from "@/lib/cors";
import { Prisma, MemberRole } from "@prisma/client";
import { sendRegistrationEmail, sendAdminDigest } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

type MemberIn = {
  fullName: string;
  gameId: string;
  discordId: string;
  email: string;
};

type CoachIn = {
  fullName: string;
  steamId: string;
  discordId: string;
  email: string;
};

type Body = {
  teamName: string;
  teamTricode: string;
  teamLeader: MemberIn;
  members: MemberIn[];
  substitutes?: MemberIn[];
  coach?: CoachIn;
};

const emailRe = /\S+@\S+\.\S+/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const teamName = (body.teamName ?? "").trim();
    const tricode = (body.teamTricode ?? "").trim().toUpperCase();

    // ----- Basic Validation -----
    if (!teamName) {
      return withCors(NextResponse.json({ ok: false, error: "teamName required" }, { status: 400 }));
    }
    if (tricode.length !== 3) {
      return withCors(NextResponse.json({ ok: false, error: "teamTricode must be 3 chars" }, { status: 400 }));
    }
    if (!body.teamLeader) {
      return withCors(NextResponse.json({ ok: false, error: "teamLeader required" }, { status: 400 }));
    }
    if (!Array.isArray(body.members) || body.members.length !== 4) {
      return withCors(NextResponse.json({ ok: false, error: "members must be an array of 4" }, { status: 400 }));
    }

    const substitutes = Array.isArray(body.substitutes) ? body.substitutes : [];
    const coach = body.coach;

    // ----- Normalize & Build Participants -----
    type Participant = {
      name: string;
      email: string;
      discordId: string;
      gameId: string;
      role: MemberRole;
    };

    const participants: Participant[] = [];

    const normalizeMember = (m: MemberIn, role: MemberRole): Participant => {
      const name = (m.fullName ?? "").trim();
      const email = (m.email ?? "").trim().toLowerCase();
      const discordId = (m.discordId ?? "").trim();
      const gameId = (m.gameId ?? "").trim();
      if (!name || !emailRe.test(email) || !discordId || !gameId) {
        throw new Error(`Invalid ${role} data`);
      }
      return { name, email, discordId, gameId, role };
    };

    participants.push(normalizeMember(body.teamLeader, MemberRole.LEADER));
    body.members.forEach((m) => participants.push(normalizeMember(m, MemberRole.MEMBER)));
    substitutes.forEach((s) => participants.push(normalizeMember(s, MemberRole.SUBSTITUTE)));

    if (coach) {
      const name = (coach.fullName ?? "").trim();
      const email = (coach.email ?? "").trim().toLowerCase();
      const discordId = (coach.discordId ?? "").trim();
      const gameId = (coach.steamId ?? "").trim();
      if (!name || !emailRe.test(email) || !discordId || !gameId) {
        return withCors(NextResponse.json({ ok: false, error: "Invalid coach data" }, { status: 400 }));
      }
      participants.push({ name, email, discordId, gameId, role: MemberRole.COACH });
    }

    // ----- Duplicate Checks (Payload) -----
    const emails = participants.map((p) => p.email);
    const dupInPayload = findDupEmails(emails);
    if (dupInPayload.length) {
      return withCors(
        NextResponse.json(
          { ok: false, error: "Duplicate emails in submission", conflicts: dupInPayload },
          { status: 409 },
        ),
      );
    }

    // ----- App-Level Uniqueness -----
    // 1) Team Tricode must be unique
    const tricodeExists = await prisma.teamMember.findFirst({
      where: { teamTricode: tricode },
      select: { id: true },
    });
    if (tricodeExists) {
      return withCors(NextResponse.json({ ok: false, error: "Team tricode already taken" }, { status: 409 }));
    }

    // 2) Global email conflicts
    const existing = await prisma.teamMember.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    if (existing.length) {
      const conflicts = existing.map((e) => e.email.toLowerCase());
      return withCors(
        NextResponse.json({ ok: false, error: "Email already registered", conflicts }, { status: 409 }),
      );
    }

    // ----- Insert Rows -----
    await prisma.teamMember.createMany({
      data: participants.map((p) => ({
        name: p.name,
        email: p.email,
        discordId: p.discordId,
        gameId: p.gameId,
        teamName,
        teamTricode: tricode,
        role: p.role,
      })),
    });

    // ----- Send confirmation emails (non-blocking) -----
    const uniqueEmails = Array.from(new Set(emails));
    // Fire-and-forget; route returns immediately while emails send
    Promise.allSettled([
      ...uniqueEmails.map((to) => sendRegistrationEmail(to, teamName, tricode)),
      sendAdminDigest(uniqueEmails, teamName, tricode),
    ]).catch((e) => console.error("Email batch error", e));

    return withCors(NextResponse.json({ ok: true }));
  } catch (err: unknown) {
    if (isP2002(err)) {
      return withCors(NextResponse.json({ ok: false, error: "Duplicate email" }, { status: 409 }));
    }
    console.error("Register error:", err);
    return withCors(NextResponse.json({ ok: false, error: "Server error" }, { status: 500 }));
  }
}

/* ---------------- helpers ---------------- */

function findDupEmails(emails: string[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const e of emails) {
    if (seen.has(e)) dup.add(e);
    seen.add(e);
  }
  return [...dup];
}

// Strict, typed Prisma error guard (no `any`)
function isP2002(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
