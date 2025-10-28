// app/admin/layout.tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getValidSession } from "@/lib/session";
import KeepAlive from "./_keepalive";

export const dynamic = "force-dynamic"; // ensure per-request cookie read
export const runtime = "nodejs";        // prisma-friendly

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_session")?.value;

  const session = await getValidSession(sessionId);
  if (!session) redirect("/login");

  // Optional allowlist check (replaces the old JWT role/email check)
  const allowed = getAdminEmails();
  if (allowed.length > 0 && !allowed.includes(session.userEmail.toLowerCase())) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <KeepAlive />
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
