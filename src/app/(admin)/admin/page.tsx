// app/(admin)/admin/page.tsx
import { cookies } from "next/headers";
import { verifySession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/admin/StatCard";
import { RecentTable } from "@/components/admin/RecentTable";
import { Activity, Users, AlertTriangle } from "lucide-react";

export default async function AdminPage() {
  // 1) Get the session token (await cookies())
  const store = await cookies();
  const token = store.get("admin_session")?.value;
  if (!token) redirect("/login");

  // 2) Verify JWT & optional role check
  try {
    const payload = await verifySession(token);
    if (payload.role !== "admin") redirect("/login");
  } catch {
    redirect("/login");
  }

  // 3) Render your admin UI
  const stats = [
    { label: "Total Team", value: "N/A", icon: Users },
    { label: "Total Registered Member", value: "N/A", icon: Activity },
    { label: "News and Updates", value: "N/A", icon: AlertTriangle },
  ];

  const rows = [
    { id: "#4102", team: "Demo", Leader: "Demo", Member: "Demo", IGN: "Demo", DiscordID: "Demo#1234", Email: "demo@demo.com" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
        ))}
      </div>
      <RecentTable rows={rows} />
    </div>
  );
}
