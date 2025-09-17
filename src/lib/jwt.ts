// Purpose: Sign/verify a compact JWT for our session cookie.

import { SignJWT, jwtVerify } from "jose";

const rawSecret = process.env.AUTH_SECRET || "";
if (rawSecret.length < 16) {
  // Fail fast in dev if secret is weak/missing
  throw new Error("AUTH_SECRET must be set and at least 16 chars long.");
}
const secret = new TextEncoder().encode(rawSecret);
const ALGO = "HS256";

export type SessionPayload = {
  sub: string; // email
  role: "admin";
};

export async function signSession(payload: SessionPayload, maxAgeSec = 60 * 60 * 8) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALGO })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALGO] });
  return payload as SessionPayload & { exp: number; iat: number };
}
