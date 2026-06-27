import { Link, useRouterState } from "@tanstack/react-router";
import React from "react";

type NavItem = {
  path: string;
  label: string;
  icon: string;
  pendingBadge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Dashboard", icon: "◈" },
  { path: "/holdings", label: "Holdings", icon: "◆" },
  { path: "/instructions", label: "Instructions", icon: "✦" },
  { path: "/gtt", label: "GTT Orders", icon: "◉" },
  { path: "/logs", label: "Agent Logs", icon: "⊟" },
  { path: "/settings", label: "Settings", icon: "◎" },
];

type SidebarProperties = {
  pendingApprovals: number;
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Collapsible sidebar navigation with active route highlighting.
 * @param props.pendingApprovals - Count of pending approvals for Instructions badge
 * @param props.collapsed - Whether the sidebar is collapsed
 * @param props.onToggle - Toggle collapsed state callback
 * @returns Sidebar element
 */
export function Sidebar({
  pendingApprovals,
  collapsed,
  onToggle,
}: SidebarProperties): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside
      className={`fixed bottom-0 top-[53px] z-30 flex flex-col border-r border-border-subtle bg-bg-sidebar transition-all duration-200 ${collapsed ? "w-[52px]" : "w-[238px]"}`}
    >
      <div className="flex flex-1 flex-col gap-1 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
          const hasBadge = item.path === "/instructions" && pendingApprovals > 0;

          return (
            <Link key={item.path} to={item.path} className={`nav-item ${isActive ? "active" : ""}`}>
              <span className="w-4 shrink-0 text-center text-[14px]">{item.icon}</span>
              {!collapsed && (
                <span className="flex flex-1 items-center justify-between">
                  {item.label}
                  {hasBadge && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-warning px-1 text-[9px] font-bold text-bg-root">
                      {pendingApprovals}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        className="mb-3 mx-2 flex h-8 items-center justify-center rounded-card border border-border-dim text-text-dim transition-colors hover:bg-bg-hover hover:text-text-secondary"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span className="text-[11px]">{collapsed ? "→" : "←"}</span>
      </button>
    </aside>
  );
}
