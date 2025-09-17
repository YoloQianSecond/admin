import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/jwt";

// Public paths that do NOT require auth
const PUBLIC_PATHS = ["/login", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next.js internals & assets to avoid loops
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/api/news/") // keep only if news images should be public
  ) {
    return NextResponse.next();
  }

  // If user is already authed, keep them off /login
  if (pathname.startsWith("/login")) {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.next();
    try {
      const p = await verifySession(token);
      const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
      if (p.sub?.toLowerCase() === adminEmail) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    } catch {
      /* invalid token -> fall through to /login */
    }
    return NextResponse.next();
  }

  // Allow other public paths (e.g., /api/auth/*)
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires a valid session
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const payload = await verifySession(token);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    if (payload.sub?.toLowerCase() !== adminEmail) throw new Error("not admin");
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set("session", "", { path: "/", httpOnly: true, maxAge: 0 });
    return res;
  }
}

// Apply to everything except Next internals/static
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
