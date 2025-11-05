// src/lib/origin.ts
import { NextRequest } from "next/server";

// Derive the real public origin even when behind Azure / proxies
function publicOrigin(req: NextRequest) {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost  = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;

  // Azure often sets x-arr-ssl for HTTPS
  const isHttpsByArr = !!req.headers.get("x-arr-ssl");
  const host = req.headers.get("host");
  if (host) return `${isHttpsByArr ? "https" : "http"}://${host}`;

  // Last fallback: URL (may be internal behind proxy)
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

// Allowed origins list (you can add staging later if needed)
const ALLOWED = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean)
);

export function isAllowedOrigin(req: NextRequest) {
  const expected = publicOrigin(req);

  const origin = req.headers.get("origin");
  if (origin) {
    if (ALLOWED.size) return ALLOWED.has(origin);
    return origin === expected;
  }

  // Some real POST requests omit Origin — fall back to Referer
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      const ref = `${u.protocol}//${u.host}`;
      return ALLOWED.size ? ALLOWED.has(ref) : ref === expected;
    } catch {}
  }
  return false;
}
