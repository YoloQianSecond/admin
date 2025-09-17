// src/app/(admin)/admin/news/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Post {
  id: string;
  title: string;
  slug: string;
  body: string;
  published: boolean;
  createdAt: string;
  imageMime?: string | null;
  hasImage?: boolean; // from API
}

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ title: "", slug: "", body: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/news", { cache: "no-store" });
    const data = await res.json();
    setPosts(data.posts ?? []);
  }

  useEffect(() => { load(); }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("slug", form.slug);
    fd.append("body", form.body);
    if (file) fd.append("image", file);

    await fetch("/api/news", { method: "POST", body: fd });
    setForm({ title: "", slug: "", body: "" });
    setFile(null);
    setPreview(null);
    await load();
  }

  async function publish(id: string) {
    await fetch(`/api/news/${id}/publish`, { method: "POST" });
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
              placeholder="Slug (unique)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />

            {/* Image upload (optional) */}
            <Input type="file" accept="image/*" onChange={onFileChange} />
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 w-auto rounded-md border object-cover"
              />
            )}

            <textarea
              className="w-full min-h-40 border rounded-md p-2"
              placeholder="Body (Markdown or HTML)"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
            <Button type="submit">Create Post</Button>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="border rounded-md p-3">
            {/* Render DB image if present */}
            {p.hasImage ? (
              <img
                src={`/api/news/${p.id}/image`}
                alt={p.title}
                className="mb-3 max-h-56 w-full rounded-md object-cover"
              />
            ) : null}

            <div className="flex items-center gap-2">
              <span className="font-medium">{p.title}</span>
              {!p.published ? (
                <Button size="sm" onClick={() => publish(p.id)}>
                  Publish
                </Button>
              ) : (
                <span className="text-xs text-green-600">Published</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">/{p.slug}</div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{p.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
