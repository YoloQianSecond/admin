"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  liveLink: string | null;
  matchDate: string; // ISO from API
  createdAt: string;
  updatedAt: string;
};

function statusFromDate(d: string) {
  const now = new Date();
  const when = new Date(d);

  // Compare by calendar day (local)
  const yyyyMmDd = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

  const today = yyyyMmDd(now);
  const day = yyyyMmDd(when);

  if (day === today) return "In Progress";
  return when.getTime() > now.getTime() ? "Upcoming" : "Completed";
}


export default function MatchScheduleAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/match-schedule", { cache: "no-store" });
      if (!r.ok) {
        console.error(await r.text());
        setItems([]);
        return;
      }
      setItems(await r.json());
    } catch (e) {
      console.error(e);
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/match-schedule", { method: "POST", body: fd });
    setPending(false);
    if (!res.ok) {
      const txt = await res.text();
      setErr(txt || "Failed to create match");
      return;
    }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this match?")) return;
    const r = await fetch(`/api/match-schedule/${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert(`Delete failed: ${await r.text()}`);
      return;
    }
    load();
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()),
    [items]
  );

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Match Schedule</h1>

      <form onSubmit={onSubmit} className="space-y-4 border p-4 rounded-xl">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex flex-col">
            <label className="font-medium">Title</label>
            <input name="title" required placeholder="e.g., Semifinal 1" className="border p-2 rounded" />
          </div>
          <div className="flex flex-col">
            <label className="font-medium">Date</label>
            {/* date-only; backend stores midnight for that date */}
            <input name="date" type="date" required className="border p-2 rounded" />
          </div>
          <div className="flex flex-col">
            <label className="font-medium">Watch Live (optional)</label>
            <input name="liveLink" placeholder="https://stream.example" className="border p-2 rounded" />
          </div>
        </div>
        {err && <p className="text-red-600">{err}</p>}
        <button disabled={pending} className="px-4 py-2 rounded bg-black text-white">
          {pending ? "Saving..." : "Add Match"}
        </button>
      </form>

      <section className="border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="text-lg font-semibold">Recent Match Results</div>
          <div className="text-sm text-gray-500">Scroll to view all matches</div>
        </div>

        <ul className="divide-y">
          {sorted.map((it) => {
            const status = statusFromDate(it.matchDate);
            const dateLabel = new Date(it.matchDate).toISOString().slice(0, 10);
            const badgeClass =
              status === "Upcoming"
                ? "bg-yellow-500/20 text-yellow-600"
                : status === "In Progress"
                ? "bg-blue-500/20 text-blue-600"
                : "bg-emerald-500/20 text-emerald-600";
            return (
              <li key={it.id} className="px-4 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sky-300 text-xl font-semibold">{it.title}</div>
                </div>

                <span className={`text-xs px-3 py-1 rounded-full ${badgeClass}`}>{status}</span>

                <div className="w-36 text-right text-slate-300">{dateLabel}</div>

                <div className="w-44 text-right">
                  {it.liveLink ? (
                    <a
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-red-300 hover:bg-red-500/10"
                      href={it.liveLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M10 16.5l6-4.5-6-4.5v9z"></path>
                        <path d="M21 3H3v18h18V3zM1 1h22v22H1V1z" fill="currentColor" opacity=".2"></path>
                      </svg>
                      <span>Watch Live</span>
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 opacity-40 cursor-not-allowed"
                      title="No live link"
                      disabled
                    >
                      <span>Watch Live</span>
                    </button>
                  )}
                </div>

                <button onClick={() => onDelete(it.id)} className="text-red-500 hover:underline ml-4">
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
