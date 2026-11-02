import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { LogoutDialog } from "./logoutDialog";
import { MAIN_NAV_ITEMS, type NavItem, SETTINGS_NAV_ITEM, isNavItemActive } from "./navItems";

// Single-broker app with no per-user identity (access-key auth), so the
// account chip is a fixed label — matching the desktop footer's "admin".
const ACCOUNT = { name: "admin", role: "Portfolio owner", initial: "A" } as const;

type AccountMenuItem = {
  label: string;
  icon: typeof LogOut;
  onSelect: () => void;
  danger?: boolean;
  isActive?: boolean;
};

/**
 * A single row in the account dropdown menu.
 * @param props.item - The menu item to render
 * @returns Menu button element
 */
function MenuButton({ item }: { item: AccountMenuItem }): React.ReactElement {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={item.onSelect}
      aria-current={item.isActive === true ? "page" : undefined}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body font-medium transition-colors ${
        item.danger
          ? "text-neg-soft hover:bg-neg-tint"
          : item.isActive === true
            ? "bg-gold/[0.13] text-fg"
            : "text-fg-soft hover:bg-surface-hover"
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4 flex-none" />
      {item.label}
    </button>
  );
}

type AccountMenuProperties = {
  /** Avatar-only trigger for the mobile header, which has no room for the chip. */
  compact?: boolean;
};

/**
 * Account trigger + dropdown shared by the desktop and mobile headers. Holds
 * the secondary routes, Settings, and Log out (behind a confirmation). A
 * disclosure of plain buttons, so Tab moves through it natively; closes on
 * outside click, Esc, or focus moving elsewhere on the page.
 * @param props.compact - render the avatar-only trigger
 * @returns Account menu element
 */
export function AccountMenu({ compact = false }: AccountMenuProperties): React.ReactElement {
  const navigate = useNavigate();
  const currentPath = useRouterState().location.pathname;
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const containerReference = useRef<HTMLDivElement>(null);
  const triggerReference = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerReference.current?.focus();
    };
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || !containerReference.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return (): void => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Secondary routes (Agent Logs, Watchlist, Health) live here rather than in
  // the streamlined sidebar or tab bar, plus Settings — all sourced from the
  // shared nav metadata so a route can't silently fall off every surface.
  const navToMenuItem = (route: NavItem): AccountMenuItem => ({
    label: route.label,
    icon: route.icon,
    isActive: isNavItemActive(route, currentPath),
    onSelect: (): void => {
      setOpen(false);
      triggerReference.current?.focus();
      void navigate({ to: route.path });
    },
  });

  const routeItems = [
    ...MAIN_NAV_ITEMS.filter(
      (item) => item.secondary === true || (compact && item.mobileMenu === true),
    ).map(navToMenuItem),
    navToMenuItem(SETTINGS_NAV_ITEM),
  ];
  const logoutItem: AccountMenuItem = {
    label: "Log out",
    icon: LogOut,
    danger: true,
    onSelect: (): void => {
      setOpen(false);
      setLogoutOpen(true);
    },
  };

  return (
    <div
      ref={containerReference}
      className="relative ml-auto flex-none"
      onBlur={(event) => {
        // A null relatedTarget is a click, which the pointer handler covers;
        // closing here too would unmount the row before its click lands.
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerReference}
        type="button"
        onClick={(): void => {
          setOpen((previous) => !previous);
        }}
        aria-expanded={open}
        aria-label="Account menu"
        className={
          compact
            ? "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            : "flex h-9 items-center gap-2.5 rounded-xl border border-border-strong bg-surface-2 px-2 transition-colors hover:border-border-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        }
      >
        {compact ? (
          ACCOUNT.initial
        ) : (
          <>
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base">
              {ACCOUNT.initial}
            </span>
            <span className="max-w-32 truncate text-body font-medium text-fg-soft">
              {ACCOUNT.name}
            </span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 flex-none text-fg-dim" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-modal max-h-[calc(100dvh-4rem)] w-60 overflow-y-auto rounded-3xl border border-border-strong bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[image:var(--gradient-gold)] font-mono text-subtitle font-bold text-bg-base">
              {ACCOUNT.initial}
            </span>
            <div className="min-w-0">
              <div className="truncate text-body font-semibold text-fg">{ACCOUNT.name}</div>
              <div className="mt-px text-caption text-fg-dim">{ACCOUNT.role}</div>
            </div>
          </div>
          <div className="p-1.5">
            {routeItems.map((item) => (
              <MenuButton key={item.label} item={item} />
            ))}
          </div>
          <div className="border-t border-border p-1.5">
            <MenuButton item={logoutItem} />
          </div>
        </div>
      )}

      <LogoutDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerReference.current?.focus();
        }}
      />
    </div>
  );
}
