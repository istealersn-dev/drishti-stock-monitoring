import { useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";

import { loginWithKey } from "../lib/api";
import { storeKey } from "../lib/auth";

/**
 * Access key gate — full-screen login shown when unauthenticated.
 * @returns Login page element
 */
export function Login(): React.ReactElement {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
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
      storeKey(trimmed);
      await navigate({ to: "/" });
    } catch {
      setError("Invalid access key. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-root">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] -translate-x-1/4 -translate-y-1/4 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,.16), transparent 62%)",
          animation: "drk-float 22s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,197,94,.10), transparent 64%)",
          animation: "drk-float2 26s ease-in-out infinite",
        }}
      />

      <div className="card card-accent-indigo relative w-full max-w-sm px-8 py-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="logo-box h-10 w-10 text-base">D</div>
          <div className="text-center">
            <h1 className="text-[16px] font-semibold tracking-tight text-text-primary">Drishti</h1>
            <p className="mt-0.5 text-[12px] text-text-muted">दृष्टि · Watchful Eye</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Access Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
              }}
              placeholder="Enter access key"
              className="w-full rounded-xl border border-border-default bg-bg-inset px-4 py-2.5 text-[13px] text-text-primary placeholder-text-muted outline-none transition-colors focus:border-primary"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error !== null && <p className="text-[12px] text-danger-text animate-fade">{error}</p>}

          <button
            type="submit"
            className="btn-primary mt-1 justify-center"
            disabled={!key.trim() || loading}
          >
            {loading ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
