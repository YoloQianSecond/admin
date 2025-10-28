// src/lib/session.ts
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Defaults (idle timeout short)
const DEFAULT_IDLE_SECONDS = Number(process.env.SESSION_IDLE_SECONDS ?? 900); // 15 minutes
// For an absolute max cap, later we could add absoluteExpiresAt column

/**
 * Create a new session with an idle expiry (expiresAt).
 * @param userEmail
 * @param idleSeconds   TTL until idle expiry (default from env)
 * @param meta          Optional metadata: user-agent, ip, etc.
 */
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
    },
  });

  return { id, expiresAt };
}

/**
 * Validate session & enforce idle expiry.
 * Returns the session record if valid. Otherwise null.
 */
export async function getValidSession(sessionId?: string) {
  if (!sessionId) return null;
  const s = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!s || s.revoked) return null;

  const now = new Date();
  if (s.expiresAt <= now) return null; // idle expired

  return s;
}

/**
 * Extend (slide) idle expiry on activity.
 * Called from /api/auth/ping during active usage.
 */
export async function touchSession(
  sessionId: string,
  idleSeconds: number = DEFAULT_IDLE_SECONDS
) {
  if (!sessionId) return null;

  const newExpires = new Date(Date.now() + idleSeconds * 1000);

  const updated = await prisma.adminSession.update({
    where: { id: sessionId },
    data: { expiresAt: newExpires },
    select: { userEmail: true, expiresAt: true },
  });

  return updated;
}

/**
 * Revoke a session (logout).
 */
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
