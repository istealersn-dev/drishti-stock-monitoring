import { RefreshCw } from "lucide-react";
import type React from "react";

import { resolveHealth, resolveStatusPill } from "../../lib/agentStatus";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/statusDot";

const APP_VERSION = "1.4";

type AppFooterProperties = {
  dryRun: boolean;
  paused: boolean;
  hasError: boolean;
  pendingCount: number;
  portfolioValueLabel: string;
  lastPollLabel: string;
  spinning: boolean;
  onRefresh: () => void;
};

/**
 * Desktop-only shell footer (Design.md §5 — 38px, meta left / session right,
 * key label 9.5px / bold value). Carries the agent status + pending-approval
 * meta that the mobile shell instead shows in `AppHeaderMobile` — the
 * desktop shell has no top header per Design.md §5, so this is where that
 * information lives on desktop. Left side: version, health dot/label
 * (paused/error-driven), the Dry Run/Paused/Running status pill, and the
 * pending badge. Right side: user, portfolio value, last poll, refresh —
 * matching project/Drishti.dc.html's footer layout exactly.
 * @param props.dryRun - whether dry-run mode is active
 * @param props.paused - whether the agent poll tick is paused
 * @param props.hasError - whether the settings/health fetch failed
 * @param props.pendingCount - number of pending buy approvals
 * @param props.portfolioValueLabel - formatted total portfolio value, e.g. "₹9,00,809"
 * @param props.lastPollLabel - formatted last-poll time, e.g. "14:02:31"
 * @param props.spinning - whether the refresh icon should spin
 * @param props.onRefresh - callback to refresh all data
 * @returns App footer element
 */
export function AppFooter({
  dryRun,
  paused,
  hasError,
  pendingCount,
  portfolioValueLabel,
  lastPollLabel,
  spinning,
  onRefresh,
}: AppFooterProperties): React.ReactElement {
  const health = resolveHealth(paused, hasError);
  const statusPill = resolveStatusPill(dryRun, paused);

  return (
    <footer className="flex h-footer flex-none items-center justify-between gap-3 border-t border-border bg-bg-chrome px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-micro text-fg-faint">
          © {new Date().getFullYear()} Drishti दृष्टि · v{APP_VERSION}
        </span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border-strong" />
        <span className="inline-flex items-center gap-1.5">
          <StatusDot variant={health.variant} label={`Agent status: ${health.label}`} />
          <span className="text-caption font-medium text-fg-soft">{health.label}</span>
        </span>
        <Badge variant={statusPill.variant}>{statusPill.label}</Badge>
        {pendingCount > 0 && <Badge variant="info">{pendingCount} pending</Badge>}
      </div>

      <div className="flex flex-none items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-micro uppercase tracking-wide text-fg-faint">User</span>
          <span className="font-mono text-micro font-bold text-fg-soft">admin</span>
        </span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border-strong" />
        <span className="inline-flex items-center gap-1.5">
          <span className="text-micro uppercase tracking-wide text-fg-faint">Portfolio</span>
          <span className="font-mono text-micro font-bold text-fg-soft">{portfolioValueLabel}</span>
        </span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border-strong" />
        <span className="inline-flex items-center gap-1.5">
          <span className="text-micro uppercase tracking-wide text-fg-faint">Last poll</span>
          <span className="font-mono text-micro font-bold text-fg-muted">{lastPollLabel}</span>
        </span>
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
