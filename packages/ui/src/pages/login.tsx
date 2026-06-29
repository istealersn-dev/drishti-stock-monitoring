import { useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";

import { loginWithKey } from "../lib/api";
import { storeKey } from "../lib/auth";

const FEATURES = [
  {
    dot: "feature-dot-success",
    text: "Autonomous stop-loss & GTT management across your NSE / BSE book",
  },
  { dot: "feature-dot-primary", text: "MTF interest burn tracked to the rupee, every single day" },
  {
    dot: "feature-dot-warning",
    text: "Every agent decision logged with full LLM reasoning & audit trail",
  },
] as const;

/**
 * Access key gate — full-screen split layout shown when unauthenticated.
 * Left: marketing panel with halftone textures. Right: access key form.
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
    <div className="relative flex h-screen w-full overflow-hidden bg-bg-root text-text-primary">
      {/* Ambient orbs */}
      <div className="orb-indigo pointer-events-none absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full animate-[drk-float_22s_ease-in-out_infinite] blur-[36px]" />
      <div className="orb-green pointer-events-none absolute -bottom-32 right-20 h-[480px] w-[480px] rounded-full animate-[drk-float2_26s_ease-in-out_infinite] blur-[40px]" />

      {/* ── Left marketing panel — hidden on mobile ── */}
      <div className="login-left hidden sm:flex">
        <div className="login-left-overlay" />
        <div className="login-halftone-purple-bl" />
        <div className="login-halftone-purple-tr" />
        <div className="login-halftone-orange-tr" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="logo-box">दृ</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-bold tracking-tight">Drishti</span>
            <span className="text-[13px] font-medium text-text-faint">दृष्टि</span>
          </div>
        </div>

        {/* Body copy */}
        <div className="relative z-10 max-w-[480px]">
          <p className="mb-7 text-[22px] font-semibold leading-[1.45] tracking-[-0.01em] text-text-primary">
            Your portfolio, watched every minute the market is open.
          </p>
          <div className="mb-8 flex flex-col gap-4">
            {FEATURES.map(({ dot, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className={`feature-dot ${dot}`} />
                <span className="text-[13.5px] text-text-secondary">{text}</span>
              </div>
            ))}
          </div>
          <div className="mb-4 h-px bg-border-strong" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-[11.5px] text-text-ghost">
              © 2026 Drishti दृष्टि · All rights reserved
            </span>
            <span className="text-[11.5px] text-text-ghost">
              Private deployment · single operator
            </span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-right flex-1 max-w-full sm:flex-[0_0_50%] sm:max-w-[50%]">
        <div className="w-full max-w-[320px]">
          <h1 className="mb-1.5 text-[20px] font-semibold tracking-[-0.01em] text-text-primary">
            Welcome back
          </h1>
          <p className="mb-6 text-[12.5px] text-text-muted">
            Enter your access key to open the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-0">
            <label className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-dim">
              Access key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
              }}
              placeholder="••••••••••••"
              autoComplete="current-password"
              autoFocus
              className="login-input mb-4"
            />

            {/* Trust this device */}
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setRemember((r) => !r);
                }}
                className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-[12.5px] text-text-tertiary"
              >
                <span
                  className={`login-checkbox ${remember ? "login-checkbox-checked" : "login-checkbox-unchecked"}`}
                >
                  {remember && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                Trust this device
              </button>
              <span className="font-mono text-[11.5px] text-text-dim">30-day session</span>
            </div>

            {error !== null && (
              <div className="login-error-banner mb-4 animate-fade">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-unlock-btn" disabled={!key.trim() || loading}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {loading ? "Verifying…" : "Unlock dashboard"}
            </button>
          </form>

          <div className="login-cf-footer">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secured via Cloudflare Tunnel
          </div>
        </div>
      </div>
    </div>
  );
}
