import {
  Activity,
  Eye,
  History,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Send,
  Settings as SettingsIcon,
  Table2,
} from "lucide-react";

export type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  pendingBadge?: boolean;
  /** Position in the mobile tab bar; items without one aren't tabs. */
  mobileTabOrder?: number;
  /** Tighter label for the mobile tab bar, where the full one won't fit. */
  shortLabel?: string;
  // Secondary routes live in the account menu on both shells (updated design
  // moved Agent Logs out of the sidebar; Watchlist/Health have no sidebar or
  // tab-bar slot in the reference) so nothing becomes unreachable.
  secondary?: boolean;
};

// Single source of truth for every route's nav metadata (icon, label,
// pending-badge eligibility) — the desktop Sidebar, the account menu, and the
// mobile tab bar all derive their item lists from this so a route can't go
// missing from one surface while staying present on another. Primary
// order matches Drishti.dc.html's sidebar exactly (Ask Drishti, Dashboard,
// Approvals, Holdings, GTT Orders); secondary items follow.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { path: "/ask", label: "Ask Drishti", icon: MessageSquare },
  { path: "/", label: "Dashboard", icon: LayoutDashboard, mobileTabOrder: 0 },
  { path: "/instructions", label: "Approvals", icon: Send, pendingBadge: true, mobileTabOrder: 2 },
  { path: "/holdings", label: "Holdings", icon: Table2, mobileTabOrder: 1 },
  { path: "/gtt", label: "GTT Orders", shortLabel: "GTT", icon: Layers, mobileTabOrder: 3 },
  { path: "/logs", label: "Agent Logs", icon: History, secondary: true },
  { path: "/watchlist", label: "Watchlist", icon: Eye, secondary: true },
  { path: "/health", label: "Health", icon: Activity, secondary: true },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  path: "/settings",
  label: "Settings",
  icon: SettingsIcon,
  mobileTabOrder: 4,
};

/**
 * Whether `currentPath` is on or under `item.path` — segment-aware, so
 * "/settings" doesn't false-positive match a hypothetical future
 * "/settings-legacy" route the way a bare `startsWith` would.
 * @param item - the nav item to check
 * @param currentPath - the router's current pathname
 * @returns whether this item should render as active
 */
export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (item.path === "/") return currentPath === "/";
  return currentPath === item.path || currentPath.startsWith(`${item.path}/`);
}
