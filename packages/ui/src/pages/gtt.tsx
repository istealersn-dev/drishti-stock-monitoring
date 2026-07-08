import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { GttCard } from "../components/gtt/gttCard";
import { GttTable } from "../components/gtt/gttTable";
import { PageHeader } from "../components/shell/pageHeader";
import { Spinner } from "../components/ui/spinner";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { fetchGttOrders } from "../lib/api";

/**
 * GTT Orders page (Design.md/handoff.md §3 "GTT table ⇄ card list") — lists
 * all GTT orders, active orders first, with a Radix Dialog confirm before
 * cancelling any active order.
 * @returns Gtt page element
 */
export function Gtt(): React.ReactElement {
  const isDesktop = useMediaQuery("(min-width: 760px)");

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["gtt"],
    queryFn: () => fetchGttOrders(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
        Failed to load GTT orders. Is the agent running?
      </div>
    );
  }

  const active = orders.filter((order) => order.status === "active");
  const rest = orders.filter((order) => order.status !== "active");
  const sorted = [...active, ...rest];

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="GTT Orders" subtitle="Stop-loss and target orders placed on Upstox." />
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No active GTTs</p>
          <p className="max-w-sm text-center text-caption text-fg-faint">
            The agent will create them automatically when SL or target conditions are met.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="GTT Orders" subtitle="Stop-loss and target orders placed on Upstox." />
      {isDesktop ? (
        <GttTable orders={sorted} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((order) => (
            <GttCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
