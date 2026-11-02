import { Link, useRouterState } from "@tanstack/react-router";
import type React from "react";

import { MAIN_NAV_ITEMS, type NavItem, SETTINGS_NAV_ITEM, isNavItemActive } from "./navItems";

// Drishti.dc.html's mobile tab order, which differs from the sidebar's. Ask
// is reached from the header logo; secondary routes from the account menu.
const MOBILE_TABS: NavItem[] = [...MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM]
  .flatMap((item) =>
    item.mobileTabOrder === undefined ? [] : [{ item, order: item.mobileTabOrder }],
  )
  .sort((a, b) => a.order - b.order)
  .map(({ item }) => item);

type MobileTabBarProperties = {
  pendingApprovals: number;
};

/**
 * Fixed bottom tab bar for the mobile shell (Design.md §5 — 62px). Pairs with
 * `AppHeaderMobile`; replaces the desktop `Sidebar` below 578px.
 * @param props.pendingApprovals - count of pending approvals for the Approvals badge
 * @returns Mobile tab bar element
 */
export function MobileTabBar({ pendingApprovals }: MobileTabBarProperties): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-chrome flex h-mobile-tabbar flex-none items-stretch border-t border-border bg-bg-chrome/95 backdrop-blur-md"
    >
      {MOBILE_TABS.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(item, currentPath);
        const hasBadge = item.pendingBadge === true && pendingApprovals > 0;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-micro ${isActive ? "text-gold" : "text-fg-faint"}`}
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
            <span className="truncate">{item.shortLabel ?? item.label}</span>
            {hasBadge && <span className="sr-only">(pending approvals)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
