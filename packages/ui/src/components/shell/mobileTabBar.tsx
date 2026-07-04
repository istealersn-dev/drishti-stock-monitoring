import { Link, useRouterState } from "@tanstack/react-router";
import {
  History,
  LayoutDashboard,
  Layers,
  Send,
  Settings as SettingsIcon,
  Table2,
} from "lucide-react";
import type React from "react";

type TabItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  pendingBadge?: boolean;
};

// The 6 core tabs Design.md §5 specifies for the mobile shell (Dashboard,
// Holdings, Instr., GTT, Logs, Settings). Watchlist/Health/Advisor stay
// desktop-sidebar-only for now — mobile real estate is fixed to these 6.
const TAB_ITEMS: TabItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/holdings", label: "Holdings", icon: Table2 },
  { path: "/instructions", label: "Instr.", icon: Send, pendingBadge: true },
  { path: "/gtt", label: "GTT", icon: Layers },
  { path: "/logs", label: "Logs", icon: History },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

type MobileTabBarProperties = {
  pendingApprovals: number;
};

/**
 * Fixed bottom tab bar for the mobile shell (Design.md §5 — 62px, 6 tabs).
 * Pairs with `AppHeaderMobile`; replaces the desktop `Sidebar` below 760px.
 * @param props.pendingApprovals - count of pending buy approvals for the Instructions badge
 * @returns Mobile tab bar element
 */
export function MobileTabBar({ pendingApprovals }: MobileTabBarProperties): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-mobile-tabbar flex-none items-stretch border-t border-border bg-bg-chrome/95 backdrop-blur-md"
    >
      {TAB_ITEMS.map((item) => {
        const isActive =
          item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
        const Icon = item.icon;
        const hasBadge = item.pendingBadge === true && pendingApprovals > 0;

        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-micro ${isActive ? "text-gold" : "text-fg-faint"}`}
          >
            <span className="relative">
              <Icon aria-hidden="true" className="h-5 w-5" />
              {hasBadge && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-info"
                />
              )}
            </span>
            <span>{item.label}</span>
            {hasBadge && <span className="sr-only">(pending approvals)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
