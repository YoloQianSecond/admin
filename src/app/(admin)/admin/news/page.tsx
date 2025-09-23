"use client";

import { useEffect, useState } from "react";
import Image from "next/image"; // ✅ use Next.js Image
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Post {
  id: string;
  title: string;
  description?: string;
  entity?: string | null;
  link?: string | null;
  date?: string | null;
  published: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt?: string; // ✅ used for cache busting images
  imageMime?: string | null;
  hasImage?: boolean;
}

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    entity: "",
    link: "",
    date: "",
    publishNow: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/news", { cache: "no-store" });
    const data = await res.json();
    setPosts(data.posts ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("entity", form.entity);
    fd.append("link", form.link);
    if (form.date) fd.append("date", form.date);
    fd.append("publishNow", String(form.publishNow));
    if (file) fd.append("image", file);

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/news/${editingId}`, { method: "PATCH", body: fd });
    } else {
      res = await fetch("/api/news", { method: "POST", body: fd });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? "Failed to save post");
      return;
    }

    resetForm();
    await load();
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      entity: "",
      link: "",
      date: "",
      publishNow: true,
    });
    setFile(null);
    setPreview(null);
    setEditingId(null);
  }

  function startEdit(p: Post) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? "",
      entity: p.entity ?? "",
      link: p.link ?? "",
      date: p.date ? p.date.substring(0, 10) : "",
      publishNow: !!p.published,
    });
    setFile(null);
    setPreview(p.hasImage ? `/api/news/${p.id}/image` : null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/news/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            <Input
              placeholder="Short Description (card excerpt)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder='Entity / Author (e.g. "Tournament Director")'
                value={form.entity}
                onChange={(e) => setForm({ ...form, entity: e.target.value })}
              />
              <Input
                placeholder='Read More link (optional, e.g. "/news/id" or "https://...")'
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
              />
            </div>

            <Input
              type="date"
              value={form.date ?? ""}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />

            {/* Image upload (optional) */}
            <Input type="file" accept="image/*" onChange={onFileChange} />
            {preview && (
              <div className="relative w-full max-w-lg h-48">
                <Image
                  src={preview}
                  alt="Preview"
                  fill
                  unoptimized
                  className="rounded-md border object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.publishNow}
                onChange={(e) =>
                  setForm({ ...form, publishNow: e.target.checked })
                }
              />
              Publish now
            </label>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? "Update Post" : "Create Post"}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="border rounded-md p-3">
            {p.hasImage && (
              <div className="relative mb-3 w-full h-56">
                <Image
                  src={`/api/news/${p.id}/image?ts=${encodeURIComponent(p.updatedAt ?? "")}`}
                  alt={p.title}
                  fill
                  unoptimized
                  className="rounded-md object-cover"
                  sizes="(max-width: 768px) 100vw, 700px"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-lg">{p.title}</span>
                <div className="text-xs text-muted-foreground">
                  {p.date ? new Date(p.date).toLocaleDateString() : ""}
                  {p.entity ? ` • ${p.entity}` : ""}
                  {p.link && (
                    <>
                      {" • "}
                      <a
                        className="underline"
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read More
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => remove(p.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            {p.description && <p className="mt-2 text-sm">{p.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
