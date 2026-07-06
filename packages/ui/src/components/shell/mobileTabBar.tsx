import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Eye,
  History,
  LayoutDashboard,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Send,
  Settings as SettingsIcon,
  Table2,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  pendingBadge?: boolean;
};

// Everything that isn't Dashboard/Ask lives behind "Others" now — 7 flat tabs
// left every label truncated ("Instr.") and every icon cramped at this width.
// Watchlist/Health are included here (they were previously mobile-unreachable
// entirely, desktop-sidebar-only) since a real overflow sheet removes the
// space constraint that excluded them before.
const OTHER_ITEMS: NavItem[] = [
  { path: "/holdings", label: "Holdings", icon: Table2 },
  { path: "/instructions", label: "Instructions", icon: Send, pendingBadge: true },
  { path: "/gtt", label: "GTT Orders", icon: Layers },
  { path: "/logs", label: "Agent Logs", icon: History },
  { path: "/watchlist", label: "Watchlist", icon: Eye },
  { path: "/health", label: "Health", icon: Activity },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
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
        <DialogPrimitive.Overlay
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-[color:rgb(10_10_10_/_0.7)] data-[state=open]:animate-fade"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border-strong bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] outline-none data-[state=open]:animate-fade"
        >
          <DialogPrimitive.Title className="mb-3 text-body-sm font-semibold text-fg">
            More
          </DialogPrimitive.Title>
          <div className="flex flex-col gap-1">
            {OTHER_ITEMS.map((item) => {
              const isActive = currentPath.startsWith(item.path);
              const Icon = item.icon;
              const hasBadge = item.pendingBadge === true && pendingApprovals > 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    onOpenChange(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm transition-colors ${isActive ? "bg-gold/[0.13] text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"}`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5 flex-none" />
                  <span className="flex-1">{item.label}</span>
                  {hasBadge && (
                    <>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-info" />
                      <span className="sr-only">(pending approvals)</span>
                    </>
                  )}
                </Link>
              );
            })}
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
  const isOthersActive = OTHER_ITEMS.some((item) => currentPath.startsWith(item.path));
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
