// src/app/(admin)/admin/teams/page.tsx
// Admin Teams page: list members, add simple form, export CSV.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RecentTable } from "@/components/admin/RecentTable"; // ✅ use alias path

type Member = {
  id: string;
  createdAt: string; // ISO string from API
  name: string;
  email: string;
  teamName?: string;
  discordId?: string;
  gameId?: string;
};

export default function TeamsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    teamName: "",
    discordId: "",
    gameId: "",
  });

  async function load() {
    const res = await fetch("/api/teams", { cache: "no-store" });
    const data = await res.json();
    setMembers(data.members ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", email: "", teamName: "", discordId: "", gameId: "" });
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={onSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              placeholder="Team Name"
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            />
            <Input
              placeholder="Discord ID"
              value={form.discordId}
              onChange={(e) => setForm({ ...form, discordId: e.target.value })}
            />
            <Input
              placeholder="Game/Steam ID"
              value={form.gameId}
              onChange={(e) => setForm({ ...form, gameId: e.target.value })}
            />
            <Button type="submit" className="md:col-span-3">
              Add Member
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <a href="/api/teams/export">
          <Button>Export CSV</Button>
        </a>
      </div>

      {/* reuse table for quick view */}
      <RecentTable
        rows={members.map((m) => ({
          id: m.id.slice(0, 6),
          name: m.name,
          action: m.email,
          at: new Date(m.createdAt).toLocaleString(),
        }))}
      />
    </div>
  );
}
