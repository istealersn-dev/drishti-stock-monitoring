import { useQuery } from "@tanstack/react-query";
import type React from "react";

import angeloneLogo from "../../assets/broker-logos/angelone.png";
import growwLogo from "../../assets/broker-logos/groww.png";
import upstoxLogo from "../../assets/broker-logos/upstox.png";
import { HEALTH_CHECK_INTERVAL_MS } from "../../lib/agentStatus";
import { fetchHealth } from "../../lib/api";
import { Badge, type BadgeVariant } from "../ui/badge";
import { Card } from "../ui/card";

// Logo-mode vs letter-fallback-mode are mutually exclusive, so this is a
// discriminated union rather than one shape with both fields always present
// — that would leave callers with a real logo carrying a meaningless empty
// `iconClassName`, and no fallback color at all if a logo import ever failed
// to resolve.
type BrokerIconProperties =
  { logo: string; name: string } | { initial: string; iconClassName: string; name: string };

function BrokerIcon(props: BrokerIconProperties): React.ReactElement {
  if ("logo" in props) {
    return (
      <img
        src={props.logo}
        alt={`${props.name} logo`}
        className="h-9 w-9 flex-none rounded-lg object-cover"
      />
    );
  }
  return (
    <span
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${props.iconClassName} font-mono text-body-sm font-bold text-white`}
    >
      {props.initial}
    </span>
  );
}

// The backend only integrates with Upstox today (CLAUDE.md). Angel One/Groww/
// HDFC Sky are shown per the design reference's 4-broker layout, but with an
// honest "Not integrated yet" status rather than the reference's fake
// connected/toggle state — real support for them is a future phase, not
// wired up here yet. HDFC Sky has no `logo` — no official asset was found —
// so it falls back to an initial-letter icon; its brand color is the only
// remaining --color-broker-* token (Angel One/Groww now use real logos).
const PLANNED_BROKERS: { id: string; name: string; icon: BrokerIconProperties }[] = [
  { id: "angelone", name: "Angel One", icon: { logo: angeloneLogo, name: "Angel One" } },
  { id: "groww", name: "Groww", icon: { logo: growwLogo, name: "Groww" } },
  {
    id: "hdfcsky",
    name: "HDFC Sky",
    icon: { initial: "H", iconClassName: "bg-[var(--color-broker-hdfcsky)]", name: "HDFC Sky" },
  },
];

type BrokerRowProperties = {
  icon: BrokerIconProperties;
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
      <BrokerIcon {...icon} />
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

  const brokers = [
    {
      id: "upstox",
      name: "Upstox",
      icon: { logo: upstoxLogo, name: "Upstox" } satisfies BrokerIconProperties,
      statusVariant: upstoxStatus.variant,
      statusLabel: upstoxStatus.label,
      dimmed: false,
    },
    ...PLANNED_BROKERS.map((broker) => ({
      ...broker,
      statusVariant: "neutral" as const,
      statusLabel: "Not integrated yet",
      dimmed: true,
    })),
  ];

  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="text-body-sm font-semibold text-fg">Connected brokers</h2>

      <div className="grid grid-cols-1 gap-3 nav:grid-cols-2">
        {brokers.map((broker) => (
          <BrokerRow
            key={broker.id}
            icon={broker.icon}
            name={broker.name}
            statusVariant={broker.statusVariant}
            statusLabel={broker.statusLabel}
            dimmed={broker.dimmed}
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
