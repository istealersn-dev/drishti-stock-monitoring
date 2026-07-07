import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquare, MoreHorizontal } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { DIALOG_OVERLAY_CLASS_NAME } from "../ui/dialog";

import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, isNavItemActive } from "./navItems";
import { NavLink } from "./navLink";

// Everything that isn't Dashboard/Ask lives behind "Others" now — 7 flat tabs
// left every label truncated ("Instr.") and every icon cramped at this width.
// Derived from the same MAIN_NAV_ITEMS/SETTINGS_NAV_ITEM the desktop Sidebar
// uses, rather than a second hand-maintained route list, so a route can't go
// missing from one surface while staying reachable on the other. Watchlist/
// Health are included here — they were previously mobile-unreachable
// entirely, desktop-sidebar-only — since a real overflow sheet removes the
// space constraint that excluded them before.
const OTHER_ITEMS = [
  ...MAIN_NAV_ITEMS.filter((item) => item.path !== "/ask" && item.path !== "/"),
  SETTINGS_NAV_ITEM,
];

type MoreSheetProperties = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  pendingApprovals: number;
};

function MoreSheet({
  open,
  onOpenChange,
  currentPath,
  pendingApprovals,
}: MoreSheetProperties): React.ReactElement {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay aria-hidden="true" className={DIALOG_OVERLAY_CLASS_NAME} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border-strong bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] outline-none data-[state=open]:animate-fade"
        >
          <DialogPrimitive.Title className="mb-3 text-body-sm font-semibold text-fg">
            More
          </DialogPrimitive.Title>
          <div className="flex flex-col gap-1">
            {OTHER_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                item={item}
                variant="sheet"
                isActive={isNavItemActive(item, currentPath)}
                hasBadge={item.pendingBadge === true && pendingApprovals > 0}
                onClick={() => {
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type MobileTabBarProperties = {
  pendingApprovals: number;
};

/**
 * Fixed bottom tab bar for the mobile shell (Design.md §5 — 62px). Reduced to
 * 3 items — Dashboard, Ask (enlarged + heartbeat-animated, the app's primary
 * surface per handoff.md §3's `/ask (index)`), and an "Others" tab that opens
 * a bottom sheet listing every other route — rather than the previous 7 flat
 * tabs, which left labels truncated ("Instr.") and icons cramped at mobile
 * widths. Pairs with `AppHeaderMobile`; replaces the desktop `Sidebar` below
 * 760px.
 * @param props.pendingApprovals - count of pending buy approvals for the Others badge
 * @returns Mobile tab bar element
 */
export function MobileTabBar({ pendingApprovals }: MobileTabBarProperties): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [othersOpen, setOthersOpen] = useState(false);

  const isDashboardActive = currentPath === "/";
  const isAskActive = currentPath.startsWith("/ask");
  const isOthersActive = !isDashboardActive && !isAskActive;
  const othersHasBadge = pendingApprovals > 0;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex h-mobile-tabbar flex-none items-stretch border-t border-border bg-bg-chrome/95 backdrop-blur-md"
      >
        <Link
          to="/"
          aria-current={isDashboardActive ? "page" : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-micro ${isDashboardActive ? "text-gold" : "text-fg-faint"}`}
        >
          <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>

        <Link
          to="/ask"
          aria-current={isAskActive ? "page" : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-1 text-micro ${isAskActive ? "text-gold" : "text-fg-faint"}`}
        >
          <MessageSquare aria-hidden="true" className="h-7 w-7 animate-heartbeat" />
          <span>Ask</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setOthersOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={othersOpen}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-micro ${isOthersActive ? "text-gold" : "text-fg-faint"}`}
        >
          <span className="relative">
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            {othersHasBadge && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-info"
              />
            )}
          </span>
          <span>Others</span>
          {othersHasBadge && <span className="sr-only">(pending approvals)</span>}
        </button>
      </nav>

      <MoreSheet
        open={othersOpen}
        onOpenChange={setOthersOpen}
        currentPath={currentPath}
        pendingApprovals={pendingApprovals}
      />
    </>
  );
}
