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


export type Row = { id: string; team: string; Leader: string; Member: string; IGN: string; DiscordID: string; Email: string};


export function RecentTable({ rows }: { rows: Row[] }) {
return (
<div className="rounded-lg border bg-card">
<Table>
<TableHeader>
<TableRow>
<TableHead>Team</TableHead>
<TableHead>Leader</TableHead>
<TableHead>Member</TableHead>
<TableHead>IGN</TableHead>
<TableHead>DiscordID</TableHead>
<TableHead>Email</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{rows.map((r) => (
<TableRow key={r.id}>
<TableCell className="font-medium">{r.id}</TableCell>
<TableCell>{r.team}</TableCell>
<TableCell>{r.Leader}</TableCell>
<TableCell>{r.Member}</TableCell>
<TableCell>{r.IGN}</TableCell>
<TableCell>{r.DiscordID}</TableCell>
<TableCell>{r.Email}</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</div>
);
}