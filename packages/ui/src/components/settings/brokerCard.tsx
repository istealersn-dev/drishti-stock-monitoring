import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { HEALTH_CHECK_INTERVAL_MS } from "../../lib/agentStatus";
import { fetchHealth } from "../../lib/api";
import { Badge, type BadgeVariant } from "../ui/badge";
import { Card } from "../ui/card";

// The backend only integrates with Upstox today (CLAUDE.md). Angel One/Groww/
// HDFC Sky are shown per the design reference's 4-broker layout, but with an
// honest "Not integrated yet" status rather than the reference's fake
// connected/toggle state — real support for them is a future phase, not
// wired up here yet.
// Full literal class names, not built from string interpolation — Tailwind's
// static scanner only generates CSS for arbitrary-value classes it can see
// verbatim in the source, so `bg-[var(${colorVar})]` would silently produce
// no styles at all.
const PLANNED_BROKERS = [
  {
    id: "angelone",
    name: "Angel One",
    initial: "A",
    iconClassName: "bg-[var(--color-broker-angelone)]",
  },
  { id: "groww", name: "Groww", initial: "G", iconClassName: "bg-[var(--color-broker-groww)]" },
  {
    id: "hdfcsky",
    name: "HDFC Sky",
    initial: "H",
    iconClassName: "bg-[var(--color-broker-hdfcsky)]",
  },
] as const;

type BrokerRowProperties = {
  icon: React.ReactNode;
  name: string;
  statusVariant: BadgeVariant;
  statusLabel: string;
  dimmed?: boolean;
};

function BrokerRow({
  icon,
  name,
  statusVariant,
  statusLabel,
  dimmed = false,
}: BrokerRowProperties): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border-strong bg-surface-2 p-3 ${dimmed ? "opacity-60" : ""}`}
    >
      {icon}
      <div>
        <div className="text-body-sm font-medium text-fg">{name}</div>
        <Badge variant={statusVariant} dot className="mt-1">
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Brokers card (handoff.md §4 `BrokerCard.tsx`) — shows all 4 brokers from
 * the design reference's layout, but scoped to what's actually true: Upstox
 * is the only one this app can actually talk to (CLAUDE.md), so its status
 * is derived from a real, live check, while Angel One/Groww/HDFC Sky show an
 * honest "Not integrated yet" badge instead of the reference's fake
 * connected/permission-toggle state — those are planned for a future phase,
 * not built here. There's also no per-broker Read/Place-Order permission
 * model for Upstox — order placement is gated by the Dry Run toggle in
 * Agent controls — so no toggle switches are shown for it either.
 *
 * Upstox's status is derived from `/api/health` (which does a real, live
 * Upstox holdings fetch), not `/api/holdings` — that endpoint only ever
 * reads a local cache and returns `ok: true` even when Upstox itself is
 * failing (e.g. an expired access token), which would silently show
 * "Connected" while Dashboard has no data.
 * @returns Broker card element
 */
export function BrokerCard(): React.ReactElement {
  const { isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: HEALTH_CHECK_INTERVAL_MS,
    refetchInterval: HEALTH_CHECK_INTERVAL_MS,
  });

  const upstoxStatus = isLoading
    ? { variant: "warn" as const, label: "Checking…" }
    : isError
      ? { variant: "neg" as const, label: "Connection issue — check agent logs" }
      : { variant: "pos" as const, label: "Connected" };

  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Connected brokers</h2>

      <div className="grid grid-cols-1 gap-3 nav:grid-cols-2">
        <BrokerRow
          icon={
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base">
              U
            </span>
          }
          name="Upstox"
          statusVariant={upstoxStatus.variant}
          statusLabel={upstoxStatus.label}
        />
        {PLANNED_BROKERS.map((broker) => (
          <BrokerRow
            key={broker.id}
            icon={
              <span
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${broker.iconClassName} font-mono text-body-sm font-bold text-white`}
              >
                {broker.initial}
              </span>
            }
            name={broker.name}
            statusVariant="neutral"
            statusLabel="Not integrated yet"
            dimmed
          />
        ))}
      </div>

      <p className="text-caption text-fg-faint">
        Drishti is hardcoded to a single Upstox account today — read access covers holdings &amp;
        market data, and order placement isn&apos;t a separate per-broker permission; it&apos;s
        gated by the Dry Run toggle in Agent controls. Angel One, Groww, and HDFC Sky are planned
        for a future phase.
      </p>
    </Card>
  );
}
