// components/admin/Header.tsx
// Purpose: Top header with app title and a placeholder user menu.


import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";


export function Header() {
return (
<header className="h-14 border-b flex items-center px-4 gap-4">
<div className="font-medium">Dashboard</div>
{/* // Add inside the right-side area */}
<form action="/api/auth/logout" method="post">
<button className="text-sm underline" type="submit">Logout</button>
</form>
<Separator orientation="vertical" className="h-6" />
<div className="ml-auto flex items-center gap-3">
<Avatar className="h-8 w-8">
<AvatarFallback>A</AvatarFallback>
</Avatar>
</div>
</header>
);
}