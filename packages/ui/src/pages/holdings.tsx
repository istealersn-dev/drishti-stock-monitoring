import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { HoldingCard } from "../components/holdings/holdingCard";
import { type ProductFilter, HoldingFilters } from "../components/holdings/holdingFilters";
import { HoldingsTable } from "../components/holdings/holdingsTable";
import { Spinner } from "../components/ui/spinner";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { type Holding, fetchGttOrders, fetchHoldings } from "../lib/api";
import { buildSlMap, resolveHoldingStatus } from "../lib/holdingStatus";

function applyFilter(
  holdings: Holding[],
  filter: ProductFilter,
  search: string,
  slMap: Map<string, number>,
): Holding[] {
  let result = holdings;
  if (filter === "MTF" || filter === "CNC") {
    result = result.filter((h) => h.product === filter);
  } else if (filter === "BREACH" || filter === "WATCH") {
    const wantVariant = filter === "BREACH" ? "neg" : "warn";
    result = result.filter((h) => resolveHoldingStatus(h, slMap).variant === wantVariant);
  }
  if (search.trim()) {
    const lower = search.toLowerCase();
    result = result.filter(
      (h) =>
        h.trading_symbol.toLowerCase().includes(lower) ||
        h.company_name.toLowerCase().includes(lower),
    );
  }
  return result;
}

/**
 * Holdings (handoff.md §4) — a filterable list of positions with inline
 * SL/target-setting. Renders `HoldingsTable` (desktop) or a stack of
 * `HoldingCard` (mobile) via `useMediaQuery`, sharing the same filtered
 * holdings and `useHoldingGttForm` row logic either way.
 * @returns Holdings page element
 */
export function Holdings(): React.ReactElement {
  const [filter, setFilter] = useState<ProductFilter>("ALL");
  const [search, setSearch] = useState("");
  const isDesktop = useMediaQuery("(min-width: 760px)");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });
  const { data: gttOrders = [] } = useQuery({
    queryKey: ["gtt", "active"],
    queryFn: () => fetchGttOrders("active"),
  });

  const holdings = data?.holdings ?? [];
  const slMap = buildSlMap(gttOrders);
  const visible = applyFilter(holdings, filter, search, slMap);

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
        Failed to load holdings. Is the agent running?
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <HoldingFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
      />

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No positions</p>
          <p className="text-caption text-fg-faint">
            {search ? "Try a different search." : "Holdings appear once data is synced."}
          </p>
        </div>
      ) : isDesktop ? (
        <HoldingsTable holdings={visible} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((holding) => (
            <HoldingCard key={`${holding.isin}-${holding.product}`} holding={holding} />
          ))}
        </div>
      )}

      {data?.cachedAt != null && (
        <p className="text-caption text-fg-faint">
          Prices cached at {new Date(data.cachedAt).toLocaleTimeString("en-IN")}
        </p>
      )}
    </div>
  );
}
