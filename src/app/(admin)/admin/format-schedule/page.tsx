"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  title: string;
  link: string | null;
  imageMime: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function FormatScheduleAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/format-schedule", { cache: "no-store" });
    setItems(await r.json());
  };

  useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/format-schedule", { method: "POST", body: fd });
    setPending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Upload failed");
      return;
    }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/format-schedule/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Format Schedule</h1>

      <form onSubmit={onSubmit} className="space-y-4 border p-4 rounded-xl">
        <div className="grid gap-3">
          <label className="font-medium">Label</label>
          <input name="title" required placeholder="e.g. Group Stage Image #1" className="border p-2 rounded"/>
        </div>
        <div className="grid gap-3">
          <label className="font-medium">Link (Optional)</label>
          <input name="link" placeholder="https://..." className="border p-2 rounded"/>
        </div>
        <div className="grid gap-3">
          <label className="font-medium">Image</label>
          <input name="image" type="file" accept="image/*" required className="border p-2 rounded"/>
        </div>
        {err && <p className="text-red-600">{err}</p>}
        <button disabled={pending} className="px-4 py-2 rounded bg-black text-white">
          {pending ? "Uploading..." : "Upload"}
        </button>
      </form>

      <section className="grid md:grid-cols-3 gap-6">
        {items.map(it => (
          <article key={it.id} className="border rounded-xl overflow-hidden">
            <div className="aspect-video bg-gray-100">
              {it.link ? (
                <a href={it.link} target="_blank" rel="noreferrer">
                  {/* Clickable image if link provided */}
                  <img
                    src={`/api/format-schedule/${it.id}/image`}
                    alt={it.title}
                    className="w-full h-full object-cover"
                  />
                </a>
              ) : (
                <img
                  src={`/api/format-schedule/${it.id}/image`}
                  alt={it.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-3 text-sm">
              <div className="font-semibold">Admin Label:</div>
              <div className="text-gray-700">{it.title}</div>
              <div className="mt-2 flex items-center justify-between">
                <a className="text-blue-600 hover:underline" href={`/api/format-schedule/${it.id}/image`} target="_blank">Open Image</a>
                <button onClick={() => onDelete(it.id)} className="text-red-600">Delete</button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
