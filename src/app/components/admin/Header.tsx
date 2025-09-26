// components/admin/Header.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
// import { useRouter } from "next/navigation";
import { useState } from "react";

export function Header() {
  // const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login"; // full reload so layout sees no cookie
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="h-14 border-b flex items-center px-4 gap-4">
      <div className="font-medium">Dashboard</div>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handleLogout}
          disabled={loading}
          className="text-sm underline"
        >
          {loading ? "Logging out..." : "Logout"}
        </button>
        <Separator orientation="vertical" className="h-6" />
        <Avatar className="h-8 w-8">
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
