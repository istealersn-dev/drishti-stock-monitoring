import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import type React from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/statusDot";

type AppHeaderMobileProperties = {
  paused: boolean;
  hasError: boolean;
  pendingCount: number;
  spinning: boolean;
  onRefresh: () => void;
};

/** Mirrors AppFooter's health resolution (Drishti.dc.html's footHealthLabel/-Color) — paused/error-driven, independent of dry-run. */
function resolveHealth(
  paused: boolean,
  hasError: boolean,
): { variant: "pos" | "neg" | "warn"; label: string } {
  if (hasError) return { variant: "neg", label: "Error" };
  if (paused) return { variant: "warn", label: "Agent paused" };
  return { variant: "pos", label: "Systems operational" };
}

/**
 * Sticky mobile top header (Design.md §5 — 50px, blurred). Carries the
 * agent status + pending-approval meta the desktop shell instead shows in
 * `AppFooter` (the mobile shell has no footer). Pairs with `MobileTabBar`
 * for the mobile shell (< 760px).
 * @param props.paused - whether the agent poll tick is paused
 * @param props.hasError - whether the settings/health fetch failed
 * @param props.pendingCount - number of pending buy approvals
 * @param props.spinning - whether the refresh icon should spin
 * @param props.onRefresh - callback to refresh all data
 * @returns Mobile app header element
 */
export function AppHeaderMobile({
  paused,
  hasError,
  pendingCount,
  spinning,
  onRefresh,
}: AppHeaderMobileProperties): React.ReactElement {
  const navigate = useNavigate();
  const { variant, label } = resolveHealth(paused, hasError);

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
