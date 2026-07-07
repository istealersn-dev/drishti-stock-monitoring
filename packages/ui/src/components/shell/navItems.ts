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
};

// Single source of truth for every route's nav metadata (icon, label,
// pending-badge eligibility) — desktop Sidebar and the mobile "Others" sheet
// both derive their item lists from this so a route can't go missing from
// one surface while staying present on the other. Order matches
// Drishti.dc.html's sidebar exactly (Ask Drishti first) — Watchlist/Health
// have no counterpart in the reference (they predate this design pass) so
// they're slotted after Agent Logs, before Ask Drishti.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { path: "/ask", label: "Ask Drishti", icon: MessageSquare },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/holdings", label: "Holdings", icon: Table2 },
  { path: "/instructions", label: "Instructions", icon: Send, pendingBadge: true },
  { path: "/gtt", label: "GTT Orders", icon: Layers },
  { path: "/logs", label: "Agent Logs", icon: History },
  { path: "/watchlist", label: "Watchlist", icon: Eye },
  { path: "/health", label: "Health", icon: Activity },
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
