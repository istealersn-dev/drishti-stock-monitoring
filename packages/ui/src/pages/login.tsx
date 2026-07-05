import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Lock } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { loginWithKey } from "../lib/api";
import { storeKey } from "../lib/auth";

const FEATURES = [
  {
    variant: "pos" as const,
    text: "Autonomous stop-loss & GTT management across your NSE / BSE book",
  },
  { variant: "info" as const, text: "MTF interest burn tracked to the rupee, every single day" },
  {
    variant: "warn" as const,
    text: "Every agent decision logged with full LLM reasoning & audit trail",
  },
];

const DOT_CLASS: Record<(typeof FEATURES)[number]["variant"], string> = {
  pos: "bg-pos",
  info: "bg-info",
  warn: "bg-warn",
};

/**
 * Access key gate (Design.md §5 — 820px split: side-by-side marketing panel
 * + form above 820px, form only below, 50:50 split per
 * project/Drishti.dc.html's `loginRightW: '50%'`). Left panel is
 * decorative/hidden on narrow viewports; right panel holds the access-key
 * form.
 * @returns Login page element
 */
export function Login(): React.ReactElement {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithKey(trimmed);
      storeKey(trimmed, remember);
      await navigate({ to: "/" });
    } catch {
      setError("Invalid access key. Check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh w-full bg-bg-base text-fg">
      {/* ── Left marketing panel — hidden below the 820px login split ── */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-bg-chrome p-11 login-split:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[image:var(--glow-gold-corners)]"
        />
        <div
          aria-hidden="true"
          className="pattern-dot-gold-strong pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="pattern-dot-gold-subtle pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body font-bold text-bg-base">
            दृ
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-title font-bold tracking-tight text-fg">Drishti</span>
            <span className="text-body-sm font-medium text-fg-faint">दृष्टि</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-7 text-h1 font-semibold text-fg">
            Your portfolio, watched every minute the market is open.
          </p>
          <div className="mb-8 flex flex-col gap-4">
            {FEATURES.map(({ variant, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 flex-none rounded-full ${DOT_CLASS[variant]}`}
                />
                <span className="text-body text-fg-soft">{text}</span>
              </div>
            ))}
          </div>
          <div className="mb-4 h-px bg-border-strong" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-caption text-fg-ghost">
              © 2026 Drishti दृष्टि · All rights reserved
            </span>
            <span className="text-caption text-fg-ghost">Private deployment · single operator</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xs">
          <h1 className="mb-1.5 text-title font-semibold text-fg">Welcome back</h1>
          <p className="mb-6 text-body-sm text-fg-muted">
            Enter your access key to open the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="login-access-key"
              label="Access key"
              type="password"
              value={key}
              onChange={setKey}
              placeholder="••••••••••••"
              autoComplete="current-password"
              autoFocus
            />

            <div className="flex items-center justify-between">
              <Switch
                id="login-remember"
                label="Trust this device"
                checked={remember}
                onChange={setRemember}
              />
              <span className="font-mono text-caption text-fg-faint">30-day session</span>
            </div>

            {error !== null && (
              <div className="flex items-center gap-2 rounded-lg border border-neg-ring bg-neg-tint p-3 text-body-sm text-neg animate-fade">
                <AlertCircle aria-hidden="true" className="h-4 w-4 flex-none" />
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" disabled={!key.trim() || loading}>
              <Lock aria-hidden="true" className="h-4 w-4" />
              {loading ? "Verifying…" : "Unlock dashboard"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
