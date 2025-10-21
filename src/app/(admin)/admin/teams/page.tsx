// src/app/(admin)/admin/teams/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type MemberRole = "LEADER" | "MEMBER" | "SUBSTITUTE" | "COACH";

type Member = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  teamName?: string | null;
  teamTricode?: string | null;
  discordId?: string | null;
  gameId?: string | null;
  role: MemberRole;
};

const ROLE_LABEL: Record<MemberRole, string> = {
  LEADER: "Leader",
  MEMBER: "Member",
  SUBSTITUTE: "Sub",
  COACH: "Coach",
};

const ROLE_CLASS: Record<MemberRole, string> = {
  LEADER:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50",
  MEMBER:
    "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700/50",
  SUBSTITUTE:
    "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50",
  COACH:
    "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700/50",
};

const TEAMS_PER_PAGE = 5;

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
    role: "MEMBER" as MemberRole,
  });

  // simple search (optional)
  const [query, setQuery] = useState("");

  // pagination
  const [page, setPage] = useState(1);

  async function load() {
    setError("");
    const res = await fetch(`/api/teams?ts=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    setMembers((data.members ?? []) as Member[]);
    setPage(1); // reset to first page on reload/search
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      teamName: "",
      teamTricode: "",
      discordId: "",
      gameId: "",
      role: "MEMBER",
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
      role: (m.role ?? "MEMBER") as MemberRole,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        teamName: form.teamName.trim() || null,
        teamTricode: form.teamTricode ? form.teamTricode.toUpperCase() : null,
        discordId: form.discordId.trim() || null,
        gameId: form.gameId.trim() || null,
        role: form.role as MemberRole,
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
    await load();
  }

  // ---- derived: group by team (tricode first; fallback to teamName; else "UNASSIGNED") + search filter
  type TeamGroup = {
    key: string;            // e.g., "DOG" or "DOG|Dog"
    tricode: string | null; // "DOG"
    teamName: string | null;
    members: Member[];
    createdAt: number;      // earliest createdAt among members (for ordering)
  };

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const hay = [
        m.name,
        m.email,
        m.teamName ?? "",
        m.teamTricode ?? "",
        m.discordId ?? "",
        m.gameId ?? "",
        m.role,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [members, query]);

  const teams: TeamGroup[] = useMemo(() => {
    const map = new Map<string, TeamGroup>();
    for (const m of filteredMembers) {
      const tricode = (m.teamTricode ?? "").toUpperCase() || null;
      const tname = m.teamName ?? null;
      const key = tricode ? `${tricode}|${tname ?? ""}` : `UNASSIGNED|${tname ?? ""}`;

      let g = map.get(key);
      if (!g) {
        g = {
          key,
          tricode,
          teamName: tname,
          members: [],
          createdAt: Number(new Date(m.createdAt)),
        };
        map.set(key, g);
      }
      g.members.push(m);
      g.createdAt = Math.min(g.createdAt, Number(new Date(m.createdAt)));
    }

    // order: newest teams first (by earliest member creation within team)
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredMembers]);

  // pagination slices
  const totalTeams = teams.length;
  const totalPages = Math.max(1, Math.ceil(totalTeams / TEAMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * TEAMS_PER_PAGE;
  const pageTeams = teams.slice(startIdx, startIdx + TEAMS_PER_PAGE);

  function roleSort(a: MemberRole, b: MemberRole) {
    const order: MemberRole[] = ["LEADER", "MEMBER", "SUBSTITUTE", "COACH"];
    return order.indexOf(a) - order.indexOf(b);
  }

  return (
    <div className="space-y-6">
      {/* Create / Edit */}
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
            <div className="md:col-span-1">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Role"
              >
                <option value="LEADER">Leader</option>
                <option value="MEMBER">Member</option>
                <option value="SUBSTITUTE">Substitute</option>
                <option value="COACH">Coach</option>
              </select>
            </div>

            <Input
              placeholder="Team Name"
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
            />
            <Input
              placeholder="Team Tricode (e.g. ABC)"
              maxLength={3}
              value={form.teamTricode}
              onChange={(e) => setForm({ ...form, teamTricode: e.target.value.toUpperCase() })}
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
              <div className="ml-auto flex gap-2">
                <Input
                  placeholder="Search teams/members…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <a href="/api/teams/export" target="_blank" rel="noopener noreferrer" className="inline-block">
                  <Button variant="outline">Export CSV</Button>
                </a>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Teams (2 per page) */}
      <div className="grid grid-cols-1 gap-4">
        {pageTeams.map((t) => {
          const sorted = [...t.members].sort((a, b) => {
            const r = roleSort(a.role, b.role);
            if (r !== 0) return r;
            return (a.name ?? "").localeCompare(b.name ?? "");
          });

          const header = t.tricode
            ? `${t.tricode}${t.teamName ? ` • ${t.teamName}` : ""}`
            : t.teamName
            ? t.teamName
            : "Unassigned";

          return (
            <Card key={t.key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">{header}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(Math.min(...t.members.map((m) => +new Date(m.createdAt)))).toLocaleString()}
                  </div>
                </div>

                <div className="divide-y">
                  {sorted.map((m) => (
                    <div key={`${m.id}-${m.updatedAt}`} className="py-2 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-medium flex items-center gap-2">
                          {m.name}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROLE_CLASS[m.role]}`}>
                            {ROLE_LABEL[m.role]}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.email}
                          {m.discordId ? ` • ${m.discordId}` : ""}
                          {m.gameId ? ` • ${m.gameId}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => startEdit(m)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {pageTeams.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No teams match your search.
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {(startIdx + 1)}–{Math.min(startIdx + TEAMS_PER_PAGE, totalTeams)} of {totalTeams} team(s)
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <div className="text-sm py-2 px-3 border rounded-md">
            Page {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
