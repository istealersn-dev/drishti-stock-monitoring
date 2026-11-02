import { Link } from "@tanstack/react-router";
import type React from "react";

import type { NavItem } from "./navItems";

type NavLinkProperties = {
  item: NavItem;
  isActive: boolean;
  hasBadge: boolean;
  collapsed?: boolean;
};

/**
 * Desktop Sidebar nav row (icon + label + pending-approval badge dot).
 * @param props.item - the nav item to render
 * @param props.isActive - whether this item's route is the current route
 * @param props.hasBadge - whether to show the pending-approval badge dot
 * @param props.collapsed - sidebar-only: icon-only mode with a title tooltip
 * @returns Nav link element
 */
export function NavLink({
  item,
  isActive,
  hasBadge,
  collapsed = false,
}: NavLinkProperties): React.ReactElement {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex items-center gap-3 h-9 rounded-lg px-2.5 text-body-sm transition-colors ${collapsed ? "justify-center" : ""} ${isActive ? "bg-gold/[0.13] text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"}`}
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
}
