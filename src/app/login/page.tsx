"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Step = "email" | "code";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0); // seconds
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);

  // If already authenticated, bounce straight to admin
  useEffect(() => {
    // best-effort check; whoami will 401 if not logged in
    fetch("/api/admin/whoami", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) window.location.href = "/admin/teams";
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown > 0 && !cooldownTimer.current) {
      cooldownTimer.current = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1 && cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
          return Math.max(0, s - 1);
        });
      }, 1000);
    }
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, [cooldown]);

  const emailNormalized = useMemo(
    () => email.trim().toLowerCase(),
    [email]
  );

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!emailNormalized) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNormalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Handle 429 cooldown hint from server
        if (res.status === 429) {
          const m: string = data.error ?? "Please wait before requesting again.";
          setMsg(m);
          // Try to parse "Please wait Xs" message to set a client countdown
          const match = m.match(/wait\s+(\d+)s/i);
          if (match) setCooldown(parseInt(match[1], 10));
        } else {
          setMsg(data.error ?? "Could not send code.");
        }
        return;
      }

      setMsg(data.message || "If the email is allowed, a code has been sent.");
      setStep("code");
      // Optional: start a minimum 30s resend cooldown for UX
      setCooldown((c) => (c > 0 ? c : 30));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // backend expects email + code; cookie is set via Set-Cookie on success
        body: JSON.stringify({ email: emailNormalized, code }),
      });
      if (res.ok) {
        // Full reload so server components/layout can read the HttpOnly cookie
        window.location.href = "/admin/teams";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  // Numeric-only code entry (prevents spaces, letters)
  function onCodeChange(v: string) {
    const digitsOnly = v.replace(/\D+/g, "").slice(0, 6);
    setCode(digitsOnly);
  }

  function onCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text") || "";
    const digits = text.replace(/\D+/g, "").slice(0, 6);
    if (!digits) return; // let default if no digits
    e.preventDefault();
    setCode(digits);
  }

  const canRequest = !loading && !!emailNormalized && cooldown === 0;
  const canVerify = !loading && code.length === 6;

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-5">
          <h1 className="text-xl font-semibold">Admin Login</h1>

          {step === "email" ? (
            <form onSubmit={requestCode} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm">Email</label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={!canRequest} className="w-full">
                {loading ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm">6-digit code</label>
                <Input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  onPaste={onCodePaste}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              <Button type="submit" disabled={!canVerify} className="w-full">
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep("email");
                    setMsg(null);
                    setCode("");
                  }}
                >
                  Change email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={cooldown > 0 || loading}
                  onClick={(e) => requestCode(e as unknown as React.FormEvent)}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </div>
            </form>
          )}

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
