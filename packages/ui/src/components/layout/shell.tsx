import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

import { fetchApprovals, fetchRuns, fetchSettings } from "../../lib/api";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const DESKTOP_MQ = "(min-width: 640px)";

/**
 * Root layout shell: full-height flex row with sidebar + topbar + main content.
 * Fetches settings, approvals, and runs to drive topbar and sidebar state.
 * @returns Shell layout element
 */
export function Shell(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches,
  );
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
    const mq = window.matchMedia(DESKTOP_MQ);
    const handleChange = (event: MediaQueryListEvent): void => {
      setIsDesktop(event.matches);
      if (event.matches) setMobileMenuOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return (): void => {
      mq.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return (): void => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const dryRun = settings?.dryRun ?? false;
  const agentStatus = settingsError ? "error" : settings?.pauseAgent ? "unknown" : "live";
  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const lastPollAt = runs[0]?.startedAt ?? null;

  const handleToggle = (): void => {
    setCollapsed((previous) => !previous);
  };

  const handleRefresh = (): void => {
    void queryClient.invalidateQueries();
  };

  const handleMobileClose = (): void => {
    setMobileMenuOpen(false);
  };

  const handleMobileOpen = (): void => {
    setMobileMenuOpen(true);
  };

  const sidebarHidden = !isDesktop && !mobileMenuOpen;

  return (
    <div className="relative flex h-screen overflow-hidden bg-bg-root">
      {/* Ambient gradient orbs */}
      <div className="orb-indigo pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] -translate-x-1/4 -translate-y-1/4 rounded-full animate-float-drk" />
      <div className="orb-green pointer-events-none fixed bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full animate-float2-drk" />

      {/* Mobile backdrop overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 sm:hidden"
          onClick={handleMobileClose}
          aria-hidden="true"
        />
      )}

      <Sidebar
        pendingApprovals={pendingCount}
        collapsed={collapsed}
        onToggle={handleToggle}
        mobileOpen={mobileMenuOpen}
        sidebarHidden={sidebarHidden}
        onMobileClose={handleMobileClose}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar
          dryRun={dryRun}
          agentStatus={agentStatus}
          pendingCount={pendingCount}
          lastPollAt={lastPollAt}
          onRefresh={handleRefresh}
          navOpen={mobileMenuOpen}
          onMobileMenuOpen={handleMobileOpen}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
