import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { HEALTH_CHECK_INTERVAL_MS } from "../../lib/agentStatus";
import { fetchHealth } from "../../lib/api";
import { Card } from "../ui/card";
import { StatusDot } from "../ui/statusDot";

/**
 * Brokers card (handoff.md §4 `BrokerCard.tsx`, scoped to what's actually
 * true) — this app is hardcoded to a single Upstox account (CLAUDE.md), not
 * a multi-broker abstraction, so this shows Upstox's real connection state
 * instead of the reference's Angel One/Groww/HDFC Sky rows, which have no
 * backing integration. There's also no per-broker Read/Place-Order
 * permission model — order placement is gated by the Dry Run toggle in
 * Agent controls — so no toggle switches are shown here either.
 *
 * Status is derived from `/api/health` (which does a real, live Upstox
 * holdings fetch), not `/api/holdings` — that endpoint only ever reads a
 * local cache and returns `ok: true` even when Upstox itself is failing
 * (e.g. an expired access token), which would silently show "Connected"
 * while Dashboard has no data.
 * @returns Broker card element
 */
export function BrokerCard(): React.ReactElement {
  const { isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: HEALTH_CHECK_INTERVAL_MS,
    refetchInterval: HEALTH_CHECK_INTERVAL_MS,
  });

  const status = isLoading
    ? { variant: "warn" as const, label: "Checking…" }
    : isError
      ? { variant: "neg" as const, label: "Connection issue — check agent logs" }
      : { variant: "pos" as const, label: "Connected" };

  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Connected brokers</h2>

      <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface-2 p-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base">
          U
        </span>
        <div>
          <div className="text-body-sm font-medium text-fg">Upstox</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatusDot variant={status.variant} label={`Upstox: ${status.label}`} pulse={false} />
            <span className="text-caption text-fg-muted">{status.label}</span>
          </div>
        </div>
      </div>

      <p className="text-caption text-fg-faint">
        Drishti is hardcoded to a single Upstox account — read access covers holdings & market data.
        Order placement isn&apos;t a separate per-broker permission here; it&apos;s gated by the Dry
        Run toggle in Agent controls.
      </p>
    </Card>
  );
}
