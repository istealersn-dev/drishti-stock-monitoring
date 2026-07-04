import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ChevronLeft,
  Eye,
  History,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Send,
  Settings as SettingsIcon,
  Table2,
} from "lucide-react";
import type React from "react";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  pendingBadge?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/holdings", label: "Holdings", icon: Table2 },
  { path: "/instructions", label: "Instructions", icon: Send, pendingBadge: true },
  { path: "/gtt", label: "GTT Orders", icon: Layers },
  { path: "/logs", label: "Agent Logs", icon: History },
  { path: "/watchlist", label: "Watchlist", icon: Eye },
  { path: "/health", label: "Health", icon: Activity },
  { path: "/ask", label: "Ask Drishti", icon: MessageSquare },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

type SidebarProperties = {
  pendingApprovals: number;
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Desktop nav sidebar (Design.md §5 — 240px expanded / 64px collapsed,
 * 53px logo header row, active = gold tint + fg). Desktop-only: the mobile
 * shell replaces this entirely with `AppHeaderMobile` + `MobileTabBar`
 * (bottom tab bar, not a slide-out drawer), per Design.md's mobile shell
 * spec.
 * @param props.pendingApprovals - count of pending buy approvals for the Instructions badge
 * @param props.collapsed - whether the sidebar is collapsed to icon-only
 * @param props.onToggle - toggles the collapsed state
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
      className={`flex h-full flex-none flex-col border-r border-border bg-bg-chrome transition-[width] duration-200 ${collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"}`}
    >
      <div className="flex h-shell-header flex-none items-center gap-2.5 px-3">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base"
          >
            दृ
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base"
          >
            दृ
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-body font-semibold tracking-tight text-fg">
              Drishti
            </span>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-muted"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <nav
        aria-label="Primary"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
          const Icon = item.icon;
          const hasBadge = item.pendingBadge === true && pendingApprovals > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-body-sm transition-colors ${collapsed ? "justify-center" : ""} ${isActive ? "bg-gold-tint text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"}`}
            >
              <Icon aria-hidden="true" className="h-5 w-5 flex-none" />
              <span className={collapsed ? "sr-only" : "flex-1 truncate"}>{item.label}</span>
              {hasBadge && (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute h-1.5 w-1.5 rounded-full bg-info ${collapsed ? "right-1.5 top-1.5" : "right-2.5 top-1/2 -translate-y-1/2"}`}
                  />
                  <span className="sr-only"> (pending approvals)</span>
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
