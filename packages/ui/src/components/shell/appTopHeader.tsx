import type React from "react";

import { PLACEHOLDER } from "../../lib/format";
import { MARKET_INDEX_NAMES } from "../../lib/marketIndices";

import { AccountMenu } from "./accountMenu";

const TICKER_INDEX_COUNT = 2;

/**
 * Market indices ticker for the desktop header's left side. Renders em-dashes
 * until an indices endpoint exists.
 * @returns Ticker element
 */
function MarketTicker(): React.ReactElement {
  return (
    <div className="hidden min-w-0 flex-nowrap items-center gap-4 overflow-hidden nav:flex">
      <span className="flex-none font-mono text-eyebrow uppercase text-fg-faint">Markets</span>
      {MARKET_INDEX_NAMES.slice(0, TICKER_INDEX_COUNT).map((name) => (
        <div key={name} className="flex flex-none items-center gap-2">
          <span className="whitespace-nowrap text-caption text-fg-dim">{name}</span>
          <span className="font-mono text-body-sm font-semibold text-fg-soft">{PLACEHOLDER}</span>
          <span className="whitespace-nowrap font-mono text-caption text-fg-dim">
            · {PLACEHOLDER}
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
    <header className="flex h-shell-header flex-none items-center justify-between gap-4 border-b border-border bg-bg-chrome px-5">
      <MarketTicker />
      <AccountMenu />
    </header>
  );
}
