// components/admin/Sidebar.tsx
// Purpose: Minimal sidebar; add nav items as you grow.


import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Package2, Home, Settings } from "lucide-react";


export function Sidebar() {
return (
<aside className="hidden md:flex w-64 min-h-screen border-r bg-card/40 p-4 sticky top-0">
<div className="w-full space-y-4">
{/* Brand */}
<div className="flex items-center gap-2 text-xl font-semibold">
<Package2 className="h-6 w-6" /> Admin
</div>
<Separator />


{/* Nav */}
<nav className="flex flex-col gap-1">
<Link href="/admin" className="px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2">
<Home className="h-4 w-4" /> Dashboard
</Link>
<Link href="/admin/teams" className="px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2">Teams</Link>
<Link href="/admin/news" className="px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2">News</Link>
<Link href="/admin/settings" className="px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2">
{/* <Settings className="h-4 w-4" /> Settings */}
</Link>
</nav>
</div>
</aside>
);
}