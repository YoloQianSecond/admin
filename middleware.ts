// // middleware.ts
// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";
// import { verifySession } from "@/lib/jwt";

// export async function middleware(req: NextRequest) {
//   const { pathname } = req.nextUrl;

//   if (
//     pathname.startsWith("/_next") ||
//     pathname.startsWith("/static") ||
//     pathname.startsWith("/images") ||
//     pathname === "/favicon.ico"
//   ) {
//     return NextResponse.next();
//   }

//   // Always allow login & OTP endpoints
//   if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
//     return NextResponse.next();
//   }

//   const token = req.cookies.get("admin_session")?.value;
//   console.log("[MIDDLEWARE] Cookie present?", !!token);

//   if (!token) {
//     console.log("[MIDDLEWARE] No token, redirecting");
//     return NextResponse.redirect(new URL("/login", req.url));
//   }

//   try {
//     const payload = await verifySession(token);
//     console.log("[MIDDLEWARE] JWT Payload:", payload);
//     return NextResponse.next();
//   } catch (e) {
//     console.log("[MIDDLEWARE] Verify failed:", e);
//     const res = NextResponse.redirect(new URL("/login", req.url));
//     res.cookies.set("admin_session", "", { path: "/", httpOnly: true, maxAge: 0 });
//     return res;
//   }
// }

// export const config = {
//   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
