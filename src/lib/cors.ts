import { NextResponse } from "next/server";

// Change this if your Vite dev server runs elsewhere
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

export function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", ORIGIN);
  res.headers.set("Vary", "Origin"); // caches correctly per origin
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // If you ever send cookies cross-origin, also set:
  // res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}

// For preflight responses
export function corsPreflight() {
  return withCors(new NextResponse(null, { status: 204 }));
}
