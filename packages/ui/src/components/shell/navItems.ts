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
  // Secondary routes live in the desktop account menu (updated design moved
  // Agent Logs out of the sidebar; Watchlist/Health have no sidebar slot in
  // the reference) rather than the primary sidebar. They stay in the mobile
  // "Others" sheet so nothing becomes unreachable on mobile.
  secondary?: boolean;
};

// Single source of truth for every route's nav metadata (icon, label,
// pending-badge eligibility) — desktop Sidebar, the desktop account menu, and
// the mobile "Others" sheet all derive their item lists from this so a route
// can't go missing from one surface while staying present on another. Primary
// order matches Drishti.dc.html's sidebar exactly (Ask Drishti, Dashboard,
// Approvals, Holdings, GTT Orders); secondary items follow.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { path: "/ask", label: "Ask Drishti", icon: MessageSquare },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/instructions", label: "Approvals", icon: Send, pendingBadge: true },
  { path: "/holdings", label: "Holdings", icon: Table2 },
  { path: "/gtt", label: "GTT Orders", icon: Layers },
  { path: "/logs", label: "Agent Logs", icon: History, secondary: true },
  { path: "/watchlist", label: "Watchlist", icon: Eye, secondary: true },
  { path: "/health", label: "Health", icon: Activity, secondary: true },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  path: "/settings",
  label: "Settings",
  icon: SettingsIcon,
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
