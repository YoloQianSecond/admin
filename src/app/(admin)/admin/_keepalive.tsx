"use client";
import { useEffect } from "react";

export default function KeepAlive() {
  useEffect(() => {
    let stop = false;

    async function ping() {
      try {
        const res = await fetch("/api/auth/ping", { method: "POST", cache: "no-store" });
        if (res.status === 401 && !stop) {
          // session idle-expired → go to login
          window.location.href = "/login";
        }
      } catch {
        // ignore network glitches
      }
    }

    // immediate ping, then every 5 minutes
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);

    return () => { stop = true; clearInterval(id); };
  }, []);

  return null;
}
