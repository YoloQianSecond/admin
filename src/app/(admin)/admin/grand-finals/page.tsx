"use client";
import { useEffect, useState } from "react";
type Item = { id: string; title: string; link: string | null; imageMime: string | null; createdAt: string; updatedAt: string; };

export default function GrandFinalsAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => setItems(await (await fetch("/api/grand-finals", { cache: "no-store" })).json());
  useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null); setPending(true);
    const res = await fetch("/api/grand-finals", { method: "POST", body: new FormData(e.currentTarget) });
    setPending(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); setErr(j.error || "Upload failed"); return; }
    (e.target as HTMLFormElement).reset(); load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/grand-finals/${id}`, { method: "DELETE" }); load();
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Grand Finals</h1>

      <form onSubmit={onSubmit} className="space-y-4 border p-4 rounded-xl">
        <div className="grid gap-3">
              <label className="font-medium">Label</label>
              <input name="title" required placeholder="Admin label e.g. Seoul GF Banner" className="border p-2 rounded w-full"/>
        </div>
        <div className="grid gap-3">
              <label className="font-medium">Link (Optional)</label>
              <input name="link" placeholder="Optional link" className="border p-2 rounded w-full"/>
        </div>
        <div className="grid gap-3">
              <label className="font-medium">Image</label>
              <input name="image" type="file" accept="image/*" required className="border p-2 rounded w-full"/>
        </div>
        {err && <p className="text-red-600">{err}</p>}
        <button disabled={pending} className="px-4 py-2 rounded bg-black text-white">{pending ? "Uploading..." : "Upload"}</button>
      </form>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map(it => (
          <article key={it.id} className="border rounded-xl overflow-hidden">
            <a href={it.link ?? "#"} target={it.link ? "_blank" : undefined} rel="noreferrer">
              <img src={`/api/grand-finals/${it.id}/image`} alt={it.title} className="w-full h-56 object-cover bg-gray-100"/>
            </a>
            <div className="p-3 text-sm flex items-center justify-between">
              <span className="font-semibold">Admin Label: {it.title}</span>
              <button onClick={() => onDelete(it.id)} className="text-red-600">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
