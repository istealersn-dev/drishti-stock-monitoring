import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";

import { Spinner } from "../components/ui/spinner";
import { type AgentLog, fetchLogs } from "../lib/api";

type LogFilter = "ALL" | "SL_EXIT" | "GTT_CREATED" | "ALERT" | "HOLD" | "APPROVAL";

const FILTER_TABS: { key: LogFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SL_EXIT", label: "SL Exit" },
  { key: "GTT_CREATED", label: "GTT Created" },
  { key: "ALERT", label: "Alert" },
  { key: "HOLD", label: "Hold" },
  { key: "APPROVAL", label: "Approval" },
];

function resolveActionChipVariant(action: string): string {
  if (action.includes("sl_exit")) return "log-action-chip-danger";
  if (action.includes("gtt_created") || action.includes("gtt_modified"))
    return "log-action-chip-success";
  if (action.includes("alert")) return "log-action-chip-warning";
  if (action.includes("hold")) return "log-action-chip-muted";
  if (action.includes("approval")) return "log-action-chip-primary";
  return "log-action-chip-default";
}

function matchesFilter(log: AgentLog, filter: LogFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "SL_EXIT") return log.action.includes("sl_exit");
  if (filter === "GTT_CREATED")
    return log.action.includes("gtt_created") || log.action.includes("gtt_modified");
  if (filter === "ALERT") return log.action.includes("alert");
  if (filter === "HOLD") return log.action.includes("hold");
  if (filter === "APPROVAL") return log.action.includes("approval");
  return true;
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

type LogRowProperties = {
  log: AgentLog;
};

function LogRow({ log }: LogRowProperties): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const actionChipVariant = resolveActionChipVariant(log.action);
  const preview =
    log.reasoning != null
      ? log.reasoning.slice(0, 90) + (log.reasoning.length > 90 ? "…" : "")
      : "";

  return (
    <div className="log-row">
      <button
        type="button"
        className="log-row-header"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
      >
        {/* Timestamp + runId */}
        <div style={{ lineHeight: 1.35 }}>
          <div className="font-mono text-[12.5px] text-[#d0d0d0]">
            {formatLogTime(log.createdAt)}
          </div>
          <div className="font-mono text-[10.5px] text-text-faint" title={log.runId}>
            {log.runId.slice(0, 8)}
          </div>
        </div>

        {/* Symbol + action + preview */}
        <div className="flex flex-wrap items-center gap-[9px]">
          {log.symbol != null && <span className="log-symbol-chip">{log.symbol}</span>}
          <span className={`log-action-chip ${actionChipVariant}`}>{log.action}</span>
          {log.dryRun === 1 && (
            <span className="log-action-chip log-action-chip-warning">dry-run</span>
          )}
          {log.error != null && (
            <span className="log-action-chip log-action-chip-danger">error</span>
          )}
          {preview.length > 0 && (
            <span className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-text-muted">
              {preview}
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6a6a6a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="justify-self-end transition-transform duration-150"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="animate-fade-drk space-y-3 px-4 pb-[14px] pl-4 sm:pl-[166px]">
          {log.reasoning != null && (
            <div>
              <div className="mb-[6px] text-[10px] uppercase tracking-[0.05em] text-text-dim">
                LLM reasoning
              </div>
              <div className="log-reasoning-block">{log.reasoning}</div>
            </div>
          )}
          {log.dryRun === 1 && (
            <div className="flex items-center gap-[6px] text-[11px] font-medium text-warning">
              <span className="inline-block h-[6px] w-[6px] rounded-full bg-warning" />
              Dry run — no real order placed
            </div>
          )}
          {log.error != null && <div className="log-error-block">{log.error}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Agent Logs page — filterable activity log with expandable LLM reasoning blocks.
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

  const visibleLogs = logs.filter((log) => matchesFilter(log, filter));

  return (
    <div className="animate-fade-drk space-y-[14px]">
      {/* Filter tabs */}
      <div className="filter-tabs max-w-full overflow-x-auto">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`filter-tab ${filter === key ? "filter-tab-active" : ""}`}
            onClick={() => {
              setFilter(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Log list */}
      <div className="holdings-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="flex h-48 items-center justify-center">
            <span className="text-[12.5px] text-danger">
              Failed to load logs. Is the agent running?
            </span>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-text-muted">
            No log entries
          </div>
        ) : (
          visibleLogs.map((log: AgentLog) => <LogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
