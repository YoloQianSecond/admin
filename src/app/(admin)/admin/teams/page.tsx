// src/app/(admin)/admin/teams/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RecentTable } from "@/components/admin/RecentTable";

type Member = {
  id: string;
  createdAt: string;
  updatedAt: string;        // ✅ for cache-busting (if ever needed)
  name: string;
  email: string;
  teamName?: string | null;
  teamTricode?: string | null;
  discordId?: string | null;
  gameId?: string | null;
  isLeader?: boolean;
};

export default function TeamsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // form + edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    teamName: "",
    teamTricode: "",
    discordId: "",
    gameId: "",
    isLeader: false,
  });

  async function load() {
    setError("");
    const res = await fetch(`/api/teams?ts=${Date.now()}`, { cache: "no-store" }); // ✅ bust any stubborn cache
    const data = await res.json();
    setMembers(data.members ?? []);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      teamName: "",
      teamTricode: "",
      discordId: "",
      gameId: "",
      isLeader: false,
    });
    setError("");
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setForm({
      name: m.name ?? "",
      email: m.email ?? "",
      teamName: m.teamName ?? "",
      teamTricode: (m.teamTricode ?? "").toUpperCase(),
      discordId: m.discordId ?? "",
      gameId: m.gameId ?? "",
      isLeader: !!m.isLeader,
    });
    setError("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      const payload = {
        name: form.name,
        email: form.email.toLowerCase(),
        teamName: form.teamName || null,
        teamTricode: form.teamTricode ? form.teamTricode.toUpperCase() : null,
        discordId: form.discordId || null,
        gameId: form.gameId || null,
        isLeader: !!form.isLeader,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/teams/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const msg =
          json?.error ||
          (res.status === 409
            ? "Duplicate email. Each email must be unique."
            : `Failed to ${editingId ? "update" : "add"} member (${res.status}).`);
        setError(msg);
        return;
      }

      resetForm();
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this member?")) return;
    setError("");
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setError(json?.error || `Failed to delete (${res.status}).`);
      return;
    }
    // Optimistic refresh
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              placeholder="Team Tricode (e.g. ABC)"
              maxLength={3}
              value={form.teamTricode}
              onChange={(e) =>
                setForm({ ...form, teamTricode: e.target.value.toUpperCase() })
              }
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

            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input
                type="checkbox"
                checked={!!form.isLeader}
                onChange={(e) => setForm({ ...form, isLeader: e.target.checked })}
              />
              Mark as Team Leader
            </label>

            {error && (
              <div className="text-red-600 text-sm md:col-span-3 -mt-1">{error}</div>
            )}

            <div className="flex gap-2 md:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? (editingId ? "Updating..." : "Adding...") : editingId ? "Update Member" : "Add Member"}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm} disabled={submitting}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <a href="/api/teams/export">
          <Button>Export CSV</Button>
        </a>
      </div>

      {/* Table with Edit/Delete */}
      <div className="space-y-2">
        {members.map((m) => (
          <div key={`${m.id}-${m.updatedAt}`} className="border rounded-md p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-medium">
                {m.name} {m.isLeader ? <span className="text-xs text-green-600">(Leader)</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {m.email}
                {m.teamTricode ? ` • ${m.teamTricode}` : ""}
                {m.teamName ? ` • ${m.teamName}` : ""}
                {m.discordId ? ` • ${m.discordId}` : ""}
                {m.gameId ? ` • ${m.gameId}` : ""}
              </div>
              <div className="text-[11px] text-muted-foreground/70">
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startEdit(m)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Optional: keep your compact RecentTable if you still want it */}
      {/* <RecentTable
        rows={members.map((m) => ({
          id: m.id.slice(0, 6),
          name: `${m.name}${m.isLeader ? " (Leader)" : ""}`,
          action:
            `${m.email}` +
            (m.teamTricode ? ` • ${m.teamTricode}` : "") +
            (m.teamName ? ` • ${m.teamName}` : ""),
          at: new Date(m.createdAt).toLocaleString(),
        }))}
      /> */}
    </div>
  );
}
