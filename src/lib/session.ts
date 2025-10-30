// src/lib/session.ts
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Idle + absolute limits from env
const DEFAULT_IDLE_SECONDS = Number(process.env.SESSION_IDLE_SECONDS ?? 900); // e.g., 60 in your tests
const ABSOLUTE_MAX_SECONDS = Number(process.env.SESSION_ABSOLUTE_SECONDS ?? 0); // e.g., 7200 (2h). 0 = disabled

/** Create a new session with idle expiry (slides on activity). */
export async function createSession(
  userEmail: string,
  idleSeconds: number = DEFAULT_IDLE_SECONDS,
  meta?: { ua?: string; ip?: string }
) {
  const id = crypto.randomBytes(32).toString("hex"); // 64-hex opaque token
  const expiresAt = new Date(Date.now() + idleSeconds * 1000);

  await prisma.adminSession.create({
    data: {
      id,
      userEmail,
      expiresAt,
      userAgent: meta?.ua,
      ip: meta?.ip,
      // assumes your Prisma model sets createdAt automatically (now())
    },
  });

  return { id, expiresAt };
}

/** Validate session; enforce idle + absolute expiry (+ optional UA/IP binding). */
export async function getValidSession(
  sessionId?: string,
  meta?: { ua?: string; ip?: string }
) {
  if (!sessionId) return null;

  const s = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!s || s.revoked) return null;

  const now = new Date();

  // Idle expiry (sliding)
  if (s.expiresAt <= now) return null;

  // Absolute max lifetime based on createdAt (no schema change needed)
  if (ABSOLUTE_MAX_SECONDS > 0) {
    // Ensure your adminSession has createdAt (DateTime @default(now()))
    const absoluteCutoff = new Date(s.createdAt.getTime() + ABSOLUTE_MAX_SECONDS * 1000);
    if (absoluteCutoff <= now) return null;
  }

  // Optional soft binding
  if (meta?.ua && s.userAgent && s.userAgent !== meta.ua) return null;
  if (meta?.ip && s.ip && s.ip !== meta.ip) return null;

  return s;
}

/**
 * Slide idle expiry on activity.
 * IMPORTANT: do NOT revive dead sessions — revalidate first.
 */
export async function touchSession(
  sessionId: string,
  idleSeconds: number = DEFAULT_IDLE_SECONDS
) {
  if (!sessionId) return null;

  // Revalidate before touching so expired/revoked/absolute-dead sessions stay dead
  const valid = await getValidSession(sessionId);
  if (!valid) return null;

  const newExpires = new Date(Date.now() + idleSeconds * 1000);

  const updated = await prisma.adminSession.update({
    where: { id: sessionId },
    data: { expiresAt: newExpires },
    select: { userEmail: true, expiresAt: true },
  });

  return updated; // { userEmail, expiresAt }
}

/** Revoke a session (logout). */
export async function revokeSession(sessionId?: string) {
  if (!sessionId) return;
  try {
    await prisma.adminSession.update({
      where: { id: sessionId },
      data: { revoked: true },
    });
  } catch {
    // ignore if not found
  }
}
