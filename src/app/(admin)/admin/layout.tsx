import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/jwt";

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const token = store.get("admin_session")?.value; // correct cookie name

  if (!token) {
    redirect("/login");
  }

  try {
    const payload = await verifySession(token);
    if (payload.role !== "admin") {
      throw new Error("Not admin");
    }

    // ✅ allowlist check for multiple emails
    const allowed = getAdminEmails();
    const userEmail = String(payload.sub || "").toLowerCase();
    if (allowed.length > 0 && !allowed.includes(userEmail)) {
      throw new Error("Not an allowed admin email");
    }
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
