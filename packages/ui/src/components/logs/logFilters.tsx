import type React from "react";

import { resolveLogCategory } from "../../lib/logFormat";
import { Tabs } from "../ui/tabs";

export type LogFilter = "ALL" | "SL_EXIT" | "GTT_CREATED" | "ALERT" | "HOLD" | "APPROVAL";

export const FILTER_TABS: { key: LogFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SL_EXIT", label: "SL Exit" },
  { key: "GTT_CREATED", label: "GTT Created" },
  { key: "ALERT", label: "Alert" },
  { key: "HOLD", label: "Hold" },
  { key: "APPROVAL", label: "Approval" },
];

function isLogFilter(value: string): value is LogFilter {
  return FILTER_TABS.some((tab) => tab.key === value);
}

export function matchesLogFilter(action: string, filter: LogFilter): boolean {
  if (filter === "ALL") return true;
  return resolveLogCategory(action) === filter;
}

type LogFiltersProperties = {
  filter: LogFilter;
  onFilterChange: (filter: LogFilter) => void;
};

/**
 * Log activity filter tabs (handoff.md §4 `LogFilters.tsx`) — a scrollable
 * Radix Tabs row (Design.md §6 "log filters" Tabs variant).
 * @param props.filter - the active log filter
 * @param props.onFilterChange - change handler for the active filter
 * @returns Log filters element
 */
export function LogFilters({ filter, onFilterChange }: LogFiltersProperties): React.ReactElement {
  return (
    <Tabs
      value={filter}
      onChange={(value) => {
        if (isLogFilter(value)) onFilterChange(value);
      }}
    >
      <Tabs.List scrollable>
        {FILTER_TABS.map(({ key, label }) => (
          <Tabs.Trigger key={key} value={key}>
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
