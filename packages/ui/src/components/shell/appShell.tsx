import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type React from "react";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import { fetchApprovals, fetchRuns, fetchSettings } from "../../lib/api";

import { AppFooter } from "./appFooter";
import { AppHeaderMobile } from "./appHeaderMobile";
import { MobileTabBar } from "./mobileTabBar";
import { Sidebar } from "./sidebar";

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
 * `useMediaQuery('(min-width: 760px)')` rather than duplicating pages; both
 * render the same routed `<Outlet/>` content. Fetches settings, approvals,
 * and runs to drive the status/pending/last-poll meta shared by both shells.
 * @returns App shell layout element
 */
export function AppShell(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const spinTimerReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDesktop = useMediaQuery("(min-width: 760px)");
  const queryClient = useQueryClient();

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

  useEffect(() => {
    return (): void => {
      if (spinTimerReference.current !== null) clearTimeout(spinTimerReference.current);
    };
  }, []);

  const dryRun = settings?.dryRun ?? false;
  const agentStatus = settingsError ? "error" : settings?.pauseAgent ? "unknown" : "live";
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const lastPollAt = runs[0]?.startedAt ?? null;

  const handleRefresh = (): void => {
    if (spinTimerReference.current !== null) clearTimeout(spinTimerReference.current);
    setSpinning(true);
    void queryClient.invalidateQueries();
    spinTimerReference.current = setTimeout(() => {
      setSpinning(false);
    }, 800);
  };

  if (!isDesktop) {
    return (
      <div className="flex h-dvh flex-col bg-bg-base">
        <AppHeaderMobile
          dryRun={dryRun}
          agentStatus={agentStatus}
          pendingCount={pendingCount}
          spinning={spinning}
          onRefresh={handleRefresh}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-20">
          <Outlet />
        </main>
        <MobileTabBar pendingApprovals={pendingCount} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-bg-base">
      <div className="flex min-h-0 flex-1">
        <Sidebar
          pendingApprovals={pendingCount}
          collapsed={collapsed}
          onToggle={() => {
            setCollapsed((previous) => !previous);
          }}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
      <AppFooter
        dryRun={dryRun}
        agentStatus={agentStatus}
        pendingCount={pendingCount}
        lastPollLabel={formatPollTime(lastPollAt)}
        spinning={spinning}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
