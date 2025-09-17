// components/admin/RecentTable.tsx
// Purpose: Simple table for recent events/activities.


import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";


export type Row = { id: string; name: string; action: string; at: string };


export function RecentTable({ rows }: { rows: Row[] }) {
return (
<div className="rounded-lg border bg-card">
<Table>
<TableHeader>
<TableRow>
<TableHead>ID</TableHead>
<TableHead>Name</TableHead>
<TableHead>Action</TableHead>
<TableHead className="text-right">Timestamp</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{rows.map((r) => (
<TableRow key={r.id}>
<TableCell className="font-medium">{r.id}</TableCell>
<TableCell>{r.name}</TableCell>
<TableCell>{r.action}</TableCell>
<TableCell className="text-right">{r.at}</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</div>
);
}