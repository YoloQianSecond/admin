// app/(admin)/admin/layout.tsx
// Purpose: Shared layout for all admin pages (sidebar + header).
// Also enforces login: redirects to /login if no valid session.

import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/jwt";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // --- Auth gate ---
  const cookieStore = await cookies();                 // ⬅️ await cookies()
  const token = cookieStore.get("session")?.value;     // ⬅️ read from store

  if (!token) {
    redirect("/login");
  }

  try {
    const payload = await verifySession(token);
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    if ((payload.sub || "").toLowerCase() !== adminEmail) {
      throw new Error("not admin");
    }
  } catch {
    redirect("/login");
  }

  // --- Layout ---
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Left sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 min-h-screen">
          <Header />
          <main className="p-6 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
