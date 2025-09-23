// app/(admin)/admin/page.tsx
// Purpose: Example one‑page dashboard with stat cards and a recent activity table.


import { StatCard } from "@/components/admin/StatCard";
import { RecentTable } from "@/components/admin/RecentTable";
import { Activity, Users, AlertTriangle } from "lucide-react";


export default function AdminPage() {
// Demo data; replace with real server data (db/fetch) later.
const stats = [
{ label: "Total Team", value: "N/A", icon: Users },
{ label: "Total Registered Member", value: "N/A", icon: Activity },
// { label: "Total News", value: "N/A", icon: PackageOpen },
{ label: "News and Updates", value: "N/A", icon: AlertTriangle },
];


const rows = [
{ id: "#4102", team: "Demo", Leader: "Demo", Member: "Demo", IGN: "Demo", DiscordID: "Demo#1234", Email: "demo@demo.com"},
];


return (
<div className="space-y-6">
{/* KPI cards */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
{stats.map((s) => (
<StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
))}
</div>


{/* Recent activity table */}
<RecentTable rows={rows} />
</div>
);
}