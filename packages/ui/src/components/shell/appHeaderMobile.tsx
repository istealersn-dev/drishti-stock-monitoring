import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import type React from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/statusDot";

type AgentStatus = "live" | "error" | "unknown";

type AppHeaderMobileProperties = {
  dryRun: boolean;
  agentStatus: AgentStatus;
  pendingCount: number;
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
 * Sticky mobile top header (Design.md §5 — 50px, blurred). Carries the
 * agent status + pending-approval meta the desktop shell instead shows in
 * `AppFooter` (the mobile shell has no footer). Pairs with `MobileTabBar`
 * for the mobile shell (< 760px).
 * @param props.dryRun - whether dry-run mode is active
 * @param props.agentStatus - current agent operational status
 * @param props.pendingCount - number of pending buy approvals
 * @param props.spinning - whether the refresh icon should spin
 * @param props.onRefresh - callback to refresh all data
 * @returns Mobile app header element
 */
export function AppHeaderMobile({
  dryRun,
  agentStatus,
  pendingCount,
  spinning,
  onRefresh,
}: AppHeaderMobileProperties): React.ReactElement {
  const navigate = useNavigate();
  const { variant, label } = resolveStatus(dryRun, agentStatus);

  return (
    <header className="sticky top-0 z-30 flex h-mobile-header flex-none items-center justify-between gap-2 border-b border-border bg-bg-chrome/85 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-[image:var(--gradient-gold)] font-mono text-micro font-bold text-bg-base">
          दृ
        </span>
        <span className="truncate text-body-sm font-semibold tracking-tight text-fg">Drishti</span>
      </div>

      <div className="flex flex-none items-center gap-2">
        <StatusDot variant={variant} label={`Agent status: ${label}`} />
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => {
              void navigate({ to: "/instructions" });
            }}
            aria-label={`${pendingCount} pending approvals`}
            className="rounded-pill transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Badge variant="info">{pendingCount} pending</Badge>
          </button>
        )}
        <Button variant="icon" aria-label="Refresh data" onClick={onRefresh}>
          <RefreshCw
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
    </header>
  );
}
