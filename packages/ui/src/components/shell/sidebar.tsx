import { useRouterState } from "@tanstack/react-router";
import { ChevronLeft, LogOut } from "lucide-react";
import type React from "react";

import { useLogout } from "../../lib/auth";

import { Logo } from "./logo";
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, isNavItemActive } from "./navItems";
import { NavLink } from "./navLink";

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
  const handleLogout = useLogout();

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
            className="mx-auto cursor-pointer rounded-lg"
          >
            <Logo />
          </button>
        ) : (
          <Logo />
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
              className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-lg text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-muted"
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
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            item={item}
            collapsed={collapsed}
            isActive={isNavItemActive(item, currentPath)}
            hasBadge={item.pendingBadge === true && pendingApprovals > 0}
          />
        ))}
      </nav>

      <div className="flex flex-none flex-col gap-0.5 border-t border-border px-2.5 py-2">
        <NavLink
          item={SETTINGS_NAV_ITEM}
          collapsed={collapsed}
          isActive={isNavItemActive(SETTINGS_NAV_ITEM, currentPath)}
          hasBadge={false}
        />
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? "Log out" : undefined}
          className={`flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-body-sm text-neg transition-colors hover:bg-neg-tint hover:text-neg-soft ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut aria-hidden="true" className="h-5 w-5 flex-none" />
          <span className={collapsed ? "sr-only" : "flex-1 truncate text-left"}>Log out</span>
        </button>
      </div>
    </aside>
  );
}
