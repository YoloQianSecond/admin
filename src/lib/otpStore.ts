// src/lib/otpStore.ts
// Purpose: Dev-time OTP storage. In prod, use a DB or KV (Upstash, Redis, etc.).

// A simple in-memory map keyed by email
const m = new Map<string, { code: string; expires: number; attempts: number }>();

const CODE_TTL_MS = 5 * 60 * 1000; // OTP valid for 5 minutes
const MAX_ATTEMPTS = 5;            // Prevent brute-force guessing

// Create a new OTP for a given email
export function createOtp(email: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit random
  const expires = Date.now() + CODE_TTL_MS;
  m.set(email.toLowerCase(), { code, expires, attempts: 0 });
  return code;
}

// Check if an OTP is valid
export function checkOtp(email: string, code: string) {
  const rec = m.get(email.toLowerCase());
  if (!rec) return { ok: false, reason: "missing" } as const;

  if (Date.now() > rec.expires) {
    m.delete(email.toLowerCase());
    return { ok: false, reason: "expired" } as const;
  }

  if (rec.attempts >= MAX_ATTEMPTS) {
    m.delete(email.toLowerCase());
    return { ok: false, reason: "locked" } as const;
  }

  rec.attempts++;

  if (rec.code === code) {
    m.delete(email.toLowerCase()); // one-time use
    return { ok: true } as const;
  }

  return { ok: false, reason: "invalid" } as const;
}
