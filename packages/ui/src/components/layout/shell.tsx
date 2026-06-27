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
    <div className="min-h-full bg-bg-root">
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
