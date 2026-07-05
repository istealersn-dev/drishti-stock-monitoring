import { Search } from "lucide-react";
import type React from "react";

import { Tabs } from "../ui/tabs";

export type ProductFilter = "ALL" | "MTF" | "CNC" | "BREACH" | "WATCH";

export const FILTER_TABS: ProductFilter[] = ["ALL", "MTF", "CNC", "BREACH", "WATCH"];

// Drishti.dc.html's filter tabs are title-case ("All", "Breach", "Watch") except
// the two product acronyms — the filter's own identifier stays uppercase for
// the `Tabs` value/comparison, this is purely the display label.
const FILTER_TAB_LABEL: Record<ProductFilter, string> = {
  ALL: "All",
  MTF: "MTF",
  CNC: "CNC",
  BREACH: "Breach",
  WATCH: "Watch",
};

function isProductFilter(value: string): value is ProductFilter {
  return FILTER_TABS.some((tab) => tab === value);
}

type HoldingFiltersProperties = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ProductFilter;
  onFilterChange: (filter: ProductFilter) => void;
};

/**
 * Holdings toolbar (handoff.md §4 `HoldingFilters.tsx`) — a search field
 * (leading icon, so it doesn't reuse the shared `Input`'s fixed layout) plus
 * a scrollable filter-tab row (Design.md §6 "log filters" Tabs variant).
 * @param props.search - controlled search text
 * @param props.onSearchChange - change handler for the search text
 * @param props.filter - the active product/exchange filter
 * @param props.onFilterChange - change handler for the active filter
 * @returns Holdings toolbar element
 */
export function HoldingFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: HoldingFiltersProperties): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5">
      <div className="relative flex-1 sm:max-w-xs">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
        />
        <label htmlFor="holdings-search" className="sr-only">
          Search holdings
        </label>
        <input
          id="holdings-search"
          type="text"
          value={search}
          placeholder="Search symbol or name…"
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          className="h-10 w-full rounded-lg border border-border-strong bg-surface-2 pl-9 pr-3 text-body text-fg outline-none transition-colors placeholder:text-fg-faint focus-visible:border-border-focus"
        />
      </div>

      <Tabs
        value={filter}
        onChange={(value) => {
          if (isProductFilter(value)) onFilterChange(value);
        }}
      >
        <Tabs.List scrollable>
          {FILTER_TABS.map((tab) => (
            <Tabs.Trigger key={tab} value={tab}>
              {FILTER_TAB_LABEL[tab]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
}
