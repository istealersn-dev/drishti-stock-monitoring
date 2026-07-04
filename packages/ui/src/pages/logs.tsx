import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

import { type LogFilter, LogFilters, matchesLogFilter } from "../components/logs/logFilters";
import { LogRow } from "../components/logs/logRow";
import { Spinner } from "../components/ui/spinner";
import { type AgentLog, fetchLogs } from "../lib/api";

/**
 * Agent Logs page (Design.md/handoff.md §3 "filterable audit trail") — a
 * category filter tab bar above a list of expandable log rows.
 * @returns Logs page element
 */
export function Logs(): React.ReactElement {
  const [filter, setFilter] = useState<LogFilter>("ALL");

  const {
    data: logs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["logs"],
    queryFn: () => fetchLogs(),
  });

  const visibleLogs = logs.filter((log) => matchesLogFilter(log.action, filter));

  return (
    <div className="flex flex-col gap-3.5">
      <LogFilters filter={filter} onFilterChange={setFilter} />

      <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="flex h-48 items-center justify-center text-body-sm text-neg">
            Failed to load logs. Is the agent running?
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-body-sm text-fg-muted">
            No log entries
          </div>
        ) : (
          visibleLogs.map((log: AgentLog) => <LogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
