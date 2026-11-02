import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type React from "react";

import { useIsDesktop } from "../../hooks/useIsDesktop";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { fetchApprovals, fetchHoldings, fetchRuns, fetchSettings } from "../../lib/api";
import { formatInr } from "../../lib/format";
import { sumHoldingsValue } from "../../lib/holdingFormat";
import { tokens } from "../../tokens/tokens";

import { AppFooter } from "./appFooter";
import { AppHeaderMobile } from "./appHeaderMobile";
import { AppTopHeader } from "./appTopHeader";
import { MobileTabBar } from "./mobileTabBar";
import { Sidebar } from "./sidebar";

const TABLET_QUERY = `(min-width: ${tokens.breakpoint.tab}px) and (max-width: ${tokens.breakpoint.lap - 1}px)`;

/** Format an ISO timestamp to HH:MM:SS in local time, or "--:--:--" if null. */
function formatPollTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Root layout shell (handoff.md §3-4) — picks the desktop shell (`Sidebar` +
 * `AppFooter`) or mobile shell (`AppHeaderMobile` + `MobileTabBar`) by
 * `useIsDesktop()` rather than duplicating pages; both
 * render the same routed `<Outlet/>` content. Fetches settings, approvals,
 * and runs to drive the status/pending/last-poll meta shared by both shells.
 * @returns App shell layout element
 */
export function AppShell(): React.ReactElement {
  // The user's explicit choice, null until they toggle the sidebar. Until
  // then it collapses on tablet widths (Drishti.dc.html: 578–1023).
  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spinTimerReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDesktop = useIsDesktop();
  const isTablet = useMediaQuery(TABLET_QUERY);
  const queryClient = useQueryClient();

  const sidebarCollapsed = collapseOverride ?? isTablet;

  // A choice made at one width shouldn't pin the sidebar at another (e.g.
  // after rotating a tablet).
  useEffect(() => {
    setCollapseOverride(null);
  }, [isTablet]);

  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { data: approvals = [] } = useQuery({
    queryKey: ["approvals"],
    queryFn: fetchApprovals,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
  });
  // Shares the ["holdings"] cache with Dashboard's own query — no extra
  // network cost, just reads whatever Dashboard (or this shell) already
  // fetched, to drive the footer/header's portfolio-value meta.
  const { data: holdingData } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  useEffect(() => {
    return (): void => {
      if (spinTimerReference.current !== null) clearTimeout(spinTimerReference.current);
    };
  }, []);

  const dryRun = settings?.dryRun ?? false;
  const paused = settings?.pauseAgent ?? false;
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const lastPollAt = runs[0]?.startedAt ?? null;
  const portfolioValue = sumHoldingsValue(holdingData?.holdings ?? []);

  const handleRefresh = (): void => {
    if (spinTimerReference.current !== null) clearTimeout(spinTimerReference.current);
    setSpinning(true);
    // Excludes ["health"] — that query triggers a real live Upstox+LLM call
    // (see BrokerCard), so the shell's refresh button (available from every
    // page) shouldn't force one just to spin the footer/header icon.
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== "health",
    });
    spinTimerReference.current = setTimeout(() => {
      setSpinning(false);
    }, 800);
  };

  // A single return with conditional siblings around one `<main><Outlet/></main>`
  // — not two separate `if (!isDesktop) return <A/>; return <B/>;` branches —
  // so `<Outlet/>` stays at the same position in the tree when `isDesktop`
  // flips (e.g. resizing across 578px). Two full return branches would each
  // mount their own `<main><Outlet/></main>`, and React would unmount/remount
  // the routed page on every breakpoint crossing, wiping its local state.
  return (
    <div className="flex h-dvh flex-col bg-bg-base">
      {!isDesktop && (
        <AppHeaderMobile
          dryRun={dryRun}
          paused={paused}
          hasError={settingsError}
          pendingCount={pendingCount}
          spinning={spinning}
          onRefresh={handleRefresh}
        />
      )}
      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <Sidebar
            pendingApprovals={pendingCount}
            collapsed={sidebarCollapsed}
            onToggle={() => {
              setCollapseOverride(!sidebarCollapsed);
            }}
          />
        )}
        {/* Right column: the desktop top header (updated design) sits above the
            scrollable main, beside the full-height sidebar. The wrapper renders
            on every breakpoint so <main><Outlet/></main> keeps its tree
            position when isDesktop flips (see the single-return note above). */}
        <div className="flex min-w-0 flex-1 flex-col">
          {isDesktop && <AppTopHeader />}
          <main
            className={
              isDesktop
                ? // Padding tightens to 16px on tablet, 20px laptop+. Past 1440px
                  // the side padding grows to cap the content, so the scroller
                  // stays full width: its scrollbar sits at the window edge and
                  // the gutters still scroll.
                  "min-w-0 w-full flex-1 overflow-y-auto p-4 lap:px-[max(1.25rem,calc((100%-90rem)/2))] lap:py-5"
                : "min-h-0 flex-1 overflow-y-auto p-4 pb-mobile-main-bottom"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
      {isDesktop && (
        <AppFooter
          dryRun={dryRun}
          paused={paused}
          hasError={settingsError}
          pendingCount={pendingCount}
          portfolioValueLabel={formatInr(portfolioValue)}
          lastPollLabel={formatPollTime(lastPollAt)}
          spinning={spinning}
          onRefresh={handleRefresh}
        />
      )}
      {!isDesktop && <MobileTabBar pendingApprovals={pendingCount} />}
    </div>
  );
}
