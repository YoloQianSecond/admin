// components/admin/StatCard.tsx
// Purpose: Small KPI card component with icon + value + label.


import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";


export function StatCard({
label,
value,
icon: Icon,
}: {
label: string;
value: string | number;
icon: LucideIcon;
}) {
return (
<Card className="shadow-sm">
<CardContent className="p-4 flex items-center gap-3">
<div className="rounded-xl border p-2">
<Icon className="h-5 w-5" />
</div>
<div>
<div className="text-2xl font-semibold leading-none">{value}</div>
<div className="text-sm text-muted-foreground">{label}</div>
</div>
</CardContent>
</Card>
);
}