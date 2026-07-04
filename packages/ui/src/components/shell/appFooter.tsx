import { RefreshCw } from "lucide-react";
import type React from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/statusDot";

type AgentStatus = "live" | "error" | "unknown";

const APP_VERSION = "1.4";

type AppFooterProperties = {
  dryRun: boolean;
  agentStatus: AgentStatus;
  pendingCount: number;
  lastPollLabel: string;
  spinning: boolean;
  onRefresh: () => void;
};

function resolveStatus(
  dryRun: boolean,
  agentStatus: AgentStatus,
): { variant: "pos" | "neg" | "warn"; label: string } {
  if (agentStatus === "error") return { variant: "neg", label: "ERROR" };
  if (dryRun) return { variant: "warn", label: "DRY RUN" };
  if (agentStatus === "live") return { variant: "pos", label: "LIVE" };
  return { variant: "warn", label: "UNKNOWN" };
}

/**
 * Desktop-only shell footer (Design.md §5 — 38px, meta left / session right,
 * key label 9.5px / bold value). Carries the agent status + pending-approval
 * meta that the mobile shell instead shows in `AppHeaderMobile` — the
 * desktop shell has no top header per Design.md §5, so this is where that
 * information lives on desktop. Pending badge is `info` tint, distinct from
 * the `warn` Dry-Run pill (handoff.md §8).
 * @param props.dryRun - whether dry-run mode is active
 * @param props.agentStatus - current agent operational status
 * @param props.pendingCount - number of pending buy approvals
 * @param props.lastPollLabel - formatted last-poll time, e.g. "14:02:31"
 * @param props.spinning - whether the refresh icon should spin
 * @param props.onRefresh - callback to refresh all data
 * @returns App footer element
 */
export function AppFooter({
  dryRun,
  agentStatus,
  pendingCount,
  lastPollLabel,
  spinning,
  onRefresh,
}: AppFooterProperties): React.ReactElement {
  const { variant, label } = resolveStatus(dryRun, agentStatus);

  return (
    <footer className="flex h-footer flex-none items-center justify-between gap-3 border-t border-border bg-bg-chrome px-4">
      <div className="flex min-w-0 items-center gap-3">
        <StatusDot variant={variant} label={`Agent status: ${label}`} />
        <span className="font-mono text-micro font-semibold tracking-wide text-fg-muted">
          {label}
        </span>
        {pendingCount > 0 && <Badge variant="info">{pendingCount} pending</Badge>}
        <span className="font-mono text-micro text-fg-faint">v{APP_VERSION}</span>
      </div>

      <div className="flex flex-none items-center gap-3">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-micro uppercase tracking-wide text-fg-faint">Last poll</span>
          <span className="font-mono text-micro font-bold text-fg-muted">{lastPollLabel}</span>
        </div>
        <Button variant="icon" aria-label="Refresh data" onClick={onRefresh}>
          <RefreshCw
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
    </footer>
  );
}
