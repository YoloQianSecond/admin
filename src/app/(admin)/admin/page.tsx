// app/(admin)/admin/page.tsx
// Purpose: Example one‑page dashboard with stat cards and a recent activity table.


import { StatCard } from "@/components/admin/StatCard";
import { RecentTable } from "@/components/admin/RecentTable";
import { Activity, Users, PackageOpen, AlertTriangle } from "lucide-react";


export default function AdminPage() {
// Demo data; replace with real server data (db/fetch) later.
const stats = [
{ label: "Active Users", value: "1,284", icon: Users },
{ label: "Sessions Today", value: "3,902", icon: Activity },
{ label: "Orders", value: "243", icon: PackageOpen },
{ label: "Alerts", value: "5", icon: AlertTriangle },
];


const rows = [
{ id: "#4102", name: "Alice", action: "Signed In", at: "2025-09-17 10:21" },
{ id: "#4101", name: "Bob", action: "Order Created", at: "2025-09-17 09:58" },
{ id: "#4100", name: "Kai", action: "Password Reset", at: "2025-09-17 09:41" },
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