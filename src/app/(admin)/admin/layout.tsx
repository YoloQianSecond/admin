// app/admin/layout.tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getValidSession } from "@/lib/session";
import KeepAlive from "./_keepalive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_session")?.value;

  const h = await headers();
  const ua = h.get("user-agent") ?? undefined;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const session = await getValidSession(sessionId, { ua, ip });
  if (!session) redirect("/login");              // ← use /admin/login consistently

  const allowed = getAdminEmails();
  if (allowed.length > 0 && !allowed.includes(session.userEmail.toLowerCase())) {
    redirect("/login");                          // ← same here
  }

  // Read the same idle window the server uses, pass to client
  const IDLE_SECONDS = Number(process.env.SESSION_IDLE_SECONDS ?? 900);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <KeepAlive idleMs={IDLE_SECONDS * 1000} />        {/* ← pass the prop */}
      <div className="flex">
        <Sidebar />
        <div className="flex-1 min-h-screen">
          <Header />
          <main className="p-6 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
