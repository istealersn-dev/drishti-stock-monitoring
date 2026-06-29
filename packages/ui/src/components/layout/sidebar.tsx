import { Link, useRouterState } from "@tanstack/react-router";
import React from "react";

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactElement;
  pendingBadge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: "/holdings",
    label: "Holdings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    path: "/instructions",
    label: "Instructions",
    pendingBadge: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
  {
    path: "/gtt",
    label: "GTT Orders",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    path: "/logs",
    label: "Agent Logs",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    path: "/settings",
    label: "Settings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
];

type SidebarProperties = {
  pendingApprovals: number;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  sidebarHidden: boolean;
  onMobileClose: () => void;
};

/**
 * Full-height collapsible sidebar with logo header, SVG nav icons, and pending badge.
 * On mobile renders as a fixed overlay drawer controlled by mobileOpen.
 * @param props.pendingApprovals - Count of pending approvals for Instructions badge
 * @param props.collapsed - Whether the sidebar is collapsed (desktop only)
 * @param props.onToggle - Toggle collapsed state callback (desktop only)
 * @param props.mobileOpen - Whether mobile drawer is open
 * @param props.sidebarHidden - True when sidebar is off-screen and must be removed from the accessibility tree
 * @param props.onMobileClose - Close mobile drawer callback
 * @returns Sidebar element
 */
export function Sidebar({
  pendingApprovals,
  collapsed,
  onToggle,
  mobileOpen,
  sidebarHidden,
  onMobileClose,
}: SidebarProperties): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside
      id="nav-sidebar"
      aria-hidden={sidebarHidden || undefined}
      inert={sidebarHidden || undefined}
      className={[
        "flex h-full flex-col border-r border-border-subtle bg-bg-sidebar transition-all duration-200",
        // Mobile: fixed overlay drawer
        "fixed inset-y-0 left-0 z-40 w-[238px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: revert to static sidebar in flow; aria-hidden/inert reset below via CSS sm: override
        "sm:relative sm:inset-y-auto sm:left-auto sm:z-20 sm:flex-none sm:translate-x-0",
        collapsed ? "sm:w-[52px]" : "sm:w-[238px]",
      ].join(" ")}
    >
      {/* Logo header — same height as topbar */}
      <div className="sidebar-header">
        <div className="sidebar-logo">दृ</div>
        <span
          className={`whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-text-primary ${collapsed ? "sm:hidden" : ""}`}
        >
          Drishti
        </span>

        {/* Mobile close button */}
        <button
          type="button"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-text-dim transition-colors hover:text-text-secondary sm:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-[3px] px-[10px] py-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
          const hasBadge = item.pendingBadge === true && pendingApprovals > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={onMobileClose}
            >
              <span className="flex-none">{item.icon}</span>
              <span className={`flex-1 ${collapsed ? "sm:hidden" : ""}`}>{item.label}</span>
              {hasBadge && <span className="nav-pending-dot" />}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <button
        type="button"
        className="sidebar-collapse-btn hidden border-t sm:flex"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
