import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";

import type { AgentLog } from "../../lib/api";
import { formatLogTime } from "../../lib/format";
import { logActionBadgeVariant } from "../../lib/logFormat";
import { Badge } from "../ui/badge";

const PREVIEW_LENGTH = 90;

type LogRowProperties = {
  log: AgentLog;
};

/**
 * Expandable agent log row (handoff.md §4 `LogRow.tsx`) — collapsed shows
 * timestamp, run id, symbol, action chip, and a reasoning preview; expanded
 * reveals the full LLM reasoning, dry-run flag, and error block.
 * @param props.log - the log entry to render
 * @returns Log row element
 */
export function LogRow({ log }: LogRowProperties): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const preview =
    log.reasoning !== null
      ? log.reasoning.slice(0, PREVIEW_LENGTH) + (log.reasoning.length > PREVIEW_LENGTH ? "…" : "")
      : "";

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
        className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <div className="leading-tight">
          <div className="font-mono text-body-sm text-fg">{formatLogTime(log.createdAt)}</div>
          <div className="font-mono text-micro text-fg-faint" title={log.runId}>
            {log.runId.slice(0, 8)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {log.symbol !== null && log.symbol !== "__portfolio__" && (
            <span className="font-mono text-caption uppercase text-fg-muted">{log.symbol}</span>
          )}
          <Badge variant={logActionBadgeVariant(log.action)}>{log.action}</Badge>
          {log.dryRun && <Badge variant="warn">dry-run</Badge>}
          {log.error !== null && <Badge variant="neg">error</Badge>}
          {preview.length > 0 && (
            <span className="max-w-[26rem] overflow-hidden text-ellipsis whitespace-nowrap text-caption text-fg-muted">
              {preview}
            </span>
          )}
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 flex-none text-fg-faint transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 px-4 pb-3.5 nav:pl-[10.5rem]">
          {log.reasoning !== null && (
            <div>
              <div className="mb-1.5 text-micro uppercase tracking-wide text-fg-faint">
                LLM reasoning
              </div>
              <div className="rounded-lg border border-border-strong bg-surface-2 p-3 text-body-sm text-fg-muted">
                {log.reasoning}
              </div>
            </div>
          )}
          {log.dryRun && (
            <p className="flex items-center gap-1.5 text-caption font-medium text-warn">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn" />
              Dry run — no real order placed
            </p>
          )}
          {log.error !== null && (
            <div className="rounded-lg border border-neg-ring bg-neg-tint p-3 text-body-sm text-neg">
              {log.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
