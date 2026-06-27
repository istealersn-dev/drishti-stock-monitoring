import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";

import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { fetchLogs, fetchRuns, type AgentLog } from "../lib/api";

function actionVariant(action: string): "success" | "danger" | "warning" | "default" | "primary" {
  if (action.includes("sl_exit")) return "danger";
  if (action.includes("gtt_created") || action.includes("gtt_modified")) return "success";
  if (action.includes("alert")) return "warning";
  if (action.includes("hold")) return "default";
  return "primary";
}

type LogRowProperties = {
  log: AgentLog;
};

function LogRow({ log }: LogRowProperties): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (): void => {
    setExpanded((previous) => !previous);
  };

  return (
    <div className="border-b border-border-subtle last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover"
        onClick={handleToggle}
      >
        <span className="w-4 shrink-0 text-[10px] text-text-dim">{expanded ? "▾" : "▸"}</span>
        <span className="font-mono text-[11px] text-text-muted">
          {new Date(log.createdAt).toLocaleTimeString("en-IN")}
        </span>
        <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
        {log.symbol && (
          <span className="font-medium text-[13px] text-text-secondary">{log.symbol}</span>
        )}
        {log.dryRun === 1 && <Badge variant="warning">dry-run</Badge>}
        {log.error && <Badge variant="danger">error</Badge>}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {log.reasoning && (
            <div className="rounded-lg border border-border-dim bg-bg-inset p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                Reasoning
              </p>
              <p className="text-[12px] leading-relaxed text-text-secondary">{log.reasoning}</p>
            </div>
          )}
          {log.error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-danger/70">
                Error
              </p>
              <p className="font-mono text-[12px] text-danger-text">{log.error}</p>
            </div>
          )}
          <p className="font-mono text-[10px] text-text-dim">run: {log.runId.slice(0, 8)}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Logs page — agent activity log with expandable reasoning blocks.
 * Filterable by run ID via dropdown.
 * @returns Logs page element
 */
export function Logs(): React.ReactElement {
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);

  const { data: runs = [] } = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs", selectedRunId],
    queryFn: () => fetchLogs(selectedRunId),
  });

  const handleRunChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedRunId(event.target.value || undefined);
  };

  return (
    <div className="animate-fade-drk space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-text-primary">Agent Logs</h1>
        <select
          className="rounded-lg border border-border-default bg-bg-inset px-3 py-1.5 text-[12px] text-text-secondary focus:border-primary focus:outline-none"
          value={selectedRunId ?? ""}
          onChange={handleRunChange}
        >
          <option value="">All runs</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {new Date(run.startedAt).toLocaleString("en-IN")} — {run.status}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-card border border-border-default bg-bg-card">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-text-muted">
            No log entries found
          </div>
        ) : (
          logs.map((log: AgentLog) => <LogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
