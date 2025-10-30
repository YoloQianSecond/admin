// app/admin/_keepalive.tsx
"use client";
import { useEffect, useRef } from "react";

type Props = { idleMs: number };

export default function KeepAlive({ idleMs }: Props) {
  const lastActive = useRef(Date.now());
  const mark = () => (lastActive.current = Date.now());

  useEffect(() => {
    // 1) Track activity
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    // 2) Intercept fetch once to react to 401s immediately
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      if (res.status === 401) {
        // Don't trap asset requests; only same-origin app/API
        try {
          const url = new URL(typeof args[0] === "string" ? args[0] : (args[0] as Request).url, location.origin);
          if (url.origin === location.origin) {
            window.location.replace("/login"); // match your real login route
            return res;
          }
        } catch {}
      }
      return res;
    };

    // 3) Timer: extend when recently active; otherwise check (no extend)
    const activeThreshold = Math.min(45_000, Math.max(10_000, Math.floor(idleMs * 0.75)));
    const tickMs = 10_000; // check every 10s so auto-kick feels immediate

    const t = setInterval(async () => {
      if (document.hidden) return;
      const since = Date.now() - lastActive.current;

      // Extend only with recent activity
      if (since < activeThreshold) {
        origFetch("/api/auth/ping", { method: "POST", credentials: "include", cache: "no-store" }).catch(() => {});
        return;
      }

      // No recent activity → just check (no extend). If dead, redirect.
      try {
        const r = await origFetch("/api/auth/check", { credentials: "include", cache: "no-store" });
        if (r.status === 401) window.location.replace("/login");
      } catch {
        // transient network error; ignore
      }
    }, tickMs);

    return () => {
      clearInterval(t);
      window.fetch = origFetch;
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [idleMs]);

  return null;
}
