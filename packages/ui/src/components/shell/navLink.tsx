import { Link } from "@tanstack/react-router";
import type React from "react";

import type { NavItem } from "./navItems";

type NavLinkVariant = "sidebar" | "sheet";

// "sidebar" is the compact 36px desktop row; "sheet" is the taller,
// bigger-tap-target row the mobile "Others" sheet needs — same active-color/
// badge logic either way, just different density for mouse vs touch input.
const VARIANT_CLASS: Record<NavLinkVariant, string> = {
  sidebar: "h-9 px-2.5",
  sheet: "px-3 py-2.5",
};

type NavLinkProperties = {
  item: NavItem;
  isActive: boolean;
  hasBadge: boolean;
  variant?: NavLinkVariant;
  collapsed?: boolean;
  onClick?: () => void;
};

/**
 * Shared nav row (icon + label + pending-approval badge dot) used by both
 * the desktop Sidebar and the mobile "Others" sheet, so the two surfaces
 * can't drift on what "active" or "has a pending badge" looks like.
 * @param props.item - the nav item to render
 * @param props.isActive - whether this item's route is the current route
 * @param props.hasBadge - whether to show the pending-approval badge dot
 * @param props.variant - "sidebar" (compact) or "sheet" (larger tap target)
 * @param props.collapsed - sidebar-only: icon-only mode with a title tooltip
 * @param props.onClick - e.g. closing a sheet after navigating
 * @returns Nav link element
 */
export function NavLink({
  item,
  isActive,
  hasBadge,
  variant = "sidebar",
  collapsed = false,
  onClick,
}: NavLinkProperties): React.ReactElement {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg text-body-sm transition-colors ${VARIANT_CLASS[variant]} ${collapsed ? "justify-center" : ""} ${isActive ? "bg-gold/[0.13] text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"}`}
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
