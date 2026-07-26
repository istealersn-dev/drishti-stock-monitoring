import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { useLogout } from "../../lib/auth";

import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM } from "./navItems";

// Single-broker app with no per-user identity (access-key auth), so the
// account chip is a fixed label — matching the desktop footer's "admin".
const ACCOUNT = { name: "Admin", role: "Portfolio owner", initial: "A" } as const;

type IndexDirection = "up" | "down" | "flat";
type MarketIndex = { name: string; value: string; change: string; direction: IndexDirection };

// Placeholder until a market-indices endpoint exists — renders the ticker
// structure with em-dashes so the header is complete now and only the data
// needs wiring later. Swap this for a query when /api/indices lands.
const PLACEHOLDER_INDICES: MarketIndex[] = [
  { name: "NIFTY 50", value: "—", change: "—", direction: "flat" },
  { name: "SENSEX", value: "—", change: "—", direction: "flat" },
];

const DIRECTION_TEXT: Record<IndexDirection, string> = {
  up: "text-pos",
  down: "text-neg",
  flat: "text-fg-dim",
};

const DIRECTION_ARROW: Record<IndexDirection, string> = { up: "▲", down: "▼", flat: "·" };

/**
 * Market indices ticker for the desktop header's left side.
 * @param props.indices - Index rows to display
 * @returns Ticker element
 */
function MarketTicker({ indices }: { indices: MarketIndex[] }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-4 overflow-hidden">
      <span className="flex-none font-mono text-eyebrow uppercase text-fg-faint">Markets</span>
      {indices.map((index) => (
        <div key={index.name} className="flex flex-none items-center gap-2">
          <span className="whitespace-nowrap text-caption text-fg-dim">{index.name}</span>
          <span className="font-mono text-body-sm font-semibold text-fg-soft">{index.value}</span>
          <span
            className={`whitespace-nowrap font-mono text-caption ${DIRECTION_TEXT[index.direction]}`}
          >
            {DIRECTION_ARROW[index.direction]} {index.change}
          </span>
        </div>
      ))}
    </div>
  );
}

type AccountMenuItem = {
  label: string;
  icon: typeof LogOut;
  onSelect: () => void;
  danger?: boolean;
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
      role="menuitem"
      onClick={item.onSelect}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body font-medium transition-colors ${
        item.danger ? "text-neg-soft hover:bg-neg-tint" : "text-fg-soft hover:bg-surface-hover"
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4 flex-none" />
      {item.label}
    </button>
  );
}

/**
 * Account chip + dropdown menu for the desktop header's right side. Opens a
 * menu with Agent Logs, Settings, and Log out; closes on outside click or Esc.
 * @returns Account menu element
 */
function AccountMenu(): React.ReactElement {
  const navigate = useNavigate();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const containerReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent): void => {
      if (!containerReference.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return (): void => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  // Secondary routes (Agent Logs, Watchlist, Health) live here on desktop
  // rather than the streamlined sidebar, plus Settings — all sourced from the
  // shared nav metadata so a route can't silently fall off both surfaces.
  const navToMenuItem = (route: {
    label: string;
    icon: typeof LogOut;
    path: string;
  }): AccountMenuItem => ({
    label: route.label,
    icon: route.icon,
    onSelect: (): void => {
      setOpen(false);
      void navigate({ to: route.path });
    },
  });

  const items: AccountMenuItem[] = [
    ...MAIN_NAV_ITEMS.filter((item) => item.secondary).map(navToMenuItem),
    navToMenuItem(SETTINGS_NAV_ITEM),
    {
      label: "Log out",
      icon: LogOut,
      danger: true,
      onSelect: (): void => {
        setOpen(false);
        logout();
      },
    },
  ];

  return (
    <div ref={containerReference} className="relative flex-none">
      <button
        type="button"
        onClick={(): void => {
          setOpen((previous) => !previous);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 items-center gap-2.5 rounded-xl border border-border-strong bg-surface-3 px-2 transition-colors hover:border-border-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-[image:var(--gradient-gold)] font-mono text-body-sm font-bold text-bg-base">
          {ACCOUNT.initial}
        </span>
        <span className="max-w-32 truncate text-body font-medium text-fg-soft">{ACCOUNT.name}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 flex-none text-fg-dim" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 overflow-hidden rounded-3xl border border-border-strong bg-surface-input shadow-card"
        >
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
            {items
              .filter((item) => !item.danger)
              .map((item) => (
                <MenuButton key={item.label} item={item} />
              ))}
          </div>
          <div className="border-t border-border p-1.5">
            {items
              .filter((item) => item.danger)
              .map((item) => (
                <MenuButton key={item.label} item={item} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Desktop-only top header (updated design): a market-indices ticker on the
 * left and an account chip + dropdown (Agent Logs / Settings / Log out) on
 * the right. Pairs with `Sidebar` + `AppFooter` for the desktop shell; the
 * mobile shell keeps `AppHeaderMobile` instead.
 * @returns Desktop top header element
 */
export function AppTopHeader(): React.ReactElement {
  return (
    <header className="flex h-desktop-header flex-none items-center justify-between gap-4 border-b border-border bg-bg-chrome px-5">
      <MarketTicker indices={PLACEHOLDER_INDICES} />
      <AccountMenu />
    </header>
  );
}
