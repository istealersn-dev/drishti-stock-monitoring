import type React from "react";

import { AccountMenu } from "./accountMenu";

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
    <div className="hidden min-w-0 flex-nowrap items-center gap-4 overflow-hidden nav:flex">
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
