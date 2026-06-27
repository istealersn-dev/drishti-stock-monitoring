import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import React, { useState } from "react";

import { fetchApprovals, fetchSettings } from "../../lib/api";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Root layout shell: topbar + collapsible sidebar + main content outlet.
 * Fetches settings and pending approvals to drive topbar and sidebar state.
 * @returns Shell layout element
 */
export function Shell(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["approvals"],
    queryFn: fetchApprovals,
  });

  const dryRun = settings?.dryRun ?? false;
  const agentStatus = settingsError ? "error" : settings?.pauseAgent ? "unknown" : "live";
  const pendingCount = approvals.length;
  const contentOffset = collapsed ? "ml-[52px]" : "ml-[238px]";

  const handleToggle = (): void => {
    setCollapsed((previous) => !previous);
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-bg-root">
      {/* Ambient gradient orbs */}
      <div
        className="pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] -translate-x-1/4 -translate-y-1/4 rounded-full opacity-100"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,.16), transparent 62%)",
          animation: "drk-float 22s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full opacity-100"
        style={{
          background: "radial-gradient(circle, rgba(34,197,94,.10), transparent 64%)",
          animation: "drk-float2 26s ease-in-out infinite",
        }}
      />

      <Topbar dryRun={dryRun} agentStatus={agentStatus} />
      <Sidebar pendingApprovals={pendingCount} collapsed={collapsed} onToggle={handleToggle} />
      <main className={`${contentOffset} pt-[53px] transition-all duration-200`}>
        <div className="p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
