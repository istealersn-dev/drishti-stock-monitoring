import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";

import { HoldingCard } from "../components/holdings/holdingCard";
import { HoldingFilters } from "../components/holdings/holdingFilters";
import { HoldingsTable } from "../components/holdings/holdingsTable";
import { PageHeader } from "../components/shell/pageHeader";
import { ErrorNotice } from "../components/ui/errorNotice";
import { Spinner } from "../components/ui/spinner";
import { useHasTableRoom } from "../hooks/useHasTableRoom";
import { type Holding, fetchGttOrders, fetchHoldings } from "../lib/api";
import { buildSlMap, resolveHoldingStatus } from "../lib/holdingStatus";
import type { ProductFilter } from "../lib/routeSearch";

const route = getRouteApi("/layout/holdings");

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
 * `HoldingCard` (mobile) via `useHasTableRoom`, sharing the same filtered
 * holdings and `useHoldingGttForm` row logic either way.
 * @returns Holdings page element
 */
export function Holdings(): React.ReactElement {
  const { filter = "ALL" } = route.useSearch();
  const navigate = route.useNavigate();
  const [search, setSearch] = useState("");
  const hasTableRoom = useHasTableRoom();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });
  const { data: gttOrders = [], isError: gttError } = useQuery({
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

  // A failed background refetch keeps its data, and any SL being typed here.
  if (isError && data === undefined) {
    return <ErrorNotice>Failed to load holdings. Is the agent running?</ErrorNotice>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Holdings"
        subtitle="All positions, with inline stop-loss and target editing."
      />
      {gttError && (
        <p role="alert" className="text-caption text-neg">
          Couldn&apos;t load GTTs, so Breach and Watch may be missing holdings.
        </p>
      )}
      <HoldingFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={(next) => {
          void navigate({ search: { filter: next }, replace: true });
        }}
      />

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No positions</p>
          <p className="text-caption text-fg-faint">
            {search ? "Try a different search." : "Holdings appear once data is synced."}
          </p>
        </div>
      ) : hasTableRoom ? (
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
