import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";

import type { Holding } from "../../lib/api";
import { formatInr } from "../../lib/format";
import { formatPrice, ltpDirectionArrow } from "../../lib/holdingFormat";
import { type HoldingStatus, resolveHoldingStatus } from "../../lib/holdingStatus";
import { Card } from "../ui/card";
import { StatusDot } from "../ui/statusDot";

const PLACEHOLDER = "—";

// Shared grid template so the header row and every position row align.
const ROW_GRID = "grid-cols-[1.4fr_1fr_0.6fr_0.8fr_1fr_1fr_0.8fr_0.8fr_1.1fr]";

type PositionsSnapshotProperties = {
  holdings: Holding[];
  slMap: Map<string, number>;
  /** How many rows to show before the "View all" link. */
  limit?: number;
};

/**
 * Percentage P&L for a holding, guarding a zero cost basis.
 * @param holding - The holding
 * @returns P&L as a percentage of cost
 */
function pnlPercentage(holding: Holding): number {
  const cost = holding.quantity * holding.average_price;
  return cost > 0 ? (holding.pnl / cost) * 100 : 0;
}

/**
 * One expandable position row: a summary line and, when open, a detail grid
 * (SL threshold, target, distance-to-SL, margin product, exchange).
 * @param props.holding - The holding to render
 * @param props.status - Precomputed SL status for the holding
 * @param props.sl - Stop-loss threshold, or undefined when none is set
 * @returns Position row element
 */
function PositionRow({
  holding,
  status,
  sl,
}: {
  holding: Holding;
  status: HoldingStatus;
  sl: number | undefined;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const pnlColor = holding.pnl >= 0 ? "text-pos" : "text-neg";
  const ltpColor = holding.last_price >= holding.close_price ? "text-pos" : "text-neg";
  const pct = pnlPercentage(holding);
  const distanceToSl =
    sl !== undefined && sl !== 0 ? ((holding.last_price - sl) / sl) * 100 : undefined;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
        aria-expanded={expanded}
        className={`grid w-full ${ROW_GRID} items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover`}
      >
        <span className="flex items-center gap-1.5 font-mono text-body-sm uppercase text-fg">
          <ChevronRight
            aria-hidden="true"
            className={`h-3.5 w-3.5 flex-none text-fg-faint transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          {holding.trading_symbol}
        </span>
        <span className="truncate text-caption text-fg-dim">{PLACEHOLDER}</span>
        <span className="text-right font-mono text-caption text-fg-muted">{holding.quantity}</span>
        <span className="text-right font-mono text-caption text-fg-muted">
          {formatPrice(holding.average_price)}
        </span>
        <span className={`text-right font-mono text-body-sm ${ltpColor}`}>
          <span aria-hidden="true">
            {ltpDirectionArrow(holding.last_price, holding.close_price)}
          </span>{" "}
          {formatPrice(holding.last_price)}
        </span>
        <span className={`text-right font-mono text-body-sm ${pnlColor}`}>
          {holding.pnl >= 0 ? "+" : "−"}
          {formatInr(Math.abs(holding.pnl))}
        </span>
        <span className={`text-right font-mono text-caption ${pnlColor}`}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
        <span className="text-right font-mono text-caption text-fg-muted">
          {sl !== undefined ? formatPrice(sl) : PLACEHOLDER}
        </span>
        <span className="flex items-center justify-end gap-1.5">
          <StatusDot variant={status.variant} label={status.label} pulse={false} />
          <span className="text-caption text-fg-muted">{status.label}</span>
        </span>
      </button>

      {expanded && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 bg-surface-2 px-9 py-3.5 nav:grid-cols-5">
          <Detail term="SL threshold" value={sl !== undefined ? formatPrice(sl) : PLACEHOLDER} />
          <Detail term="Target price" value={PLACEHOLDER} />
          <Detail
            term="Distance to SL"
            value={distanceToSl !== undefined ? `${distanceToSl.toFixed(1)}%` : PLACEHOLDER}
          />
          <Detail term="Margin product" value={holding.product} />
          <Detail term="Exchange" value={holding.exchange} />
        </dl>
      )}
    </div>
  );
}

/**
 * A labelled value in the expanded position detail grid.
 * @param props.term - Field label
 * @param props.value - Field value
 * @returns Detail element
 */
function Detail({ term, value }: { term: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-micro uppercase tracking-wide text-fg-faint">{term}</dt>
      <dd className="font-mono text-caption text-fg-soft">{value}</dd>
    </div>
  );
}

/**
 * Positions snapshot (updated design) — a compact, expandable holdings table
 * for the dashboard. Each row expands to show SL/target/exchange detail; a
 * "View all" link goes to the full Holdings page. Sector and target are
 * placeholders until their data sources exist.
 * @param props.holdings - Current holdings
 * @param props.slMap - Symbol -> stop-loss threshold, for status + SL columns
 * @param props.limit - Max rows before the "View all" link (default 5)
 * @returns Positions snapshot card
 */
export function PositionsSnapshot({
  holdings,
  slMap,
  limit = 5,
}: PositionsSnapshotProperties): React.ReactElement {
  const rows = holdings.slice(0, limit);

  return (
    <Card className="flex flex-col gap-0 overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-body-sm font-semibold text-fg">Positions snapshot</span>
        <Link
          to="/holdings"
          className="font-mono text-caption text-gold transition-colors hover:text-gold-bright"
        >
          View all {holdings.length} ›
        </Link>
      </div>

      {rows.length > 0 && (
        <div
          className={`grid ${ROW_GRID} items-center gap-2 border-b border-border bg-surface-2 px-3 py-2 text-micro uppercase tracking-wide text-fg-faint`}
        >
          <span className="pl-5">Symbol</span>
          <span>Sector</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Avg</span>
          <span className="text-right">LTP</span>
          <span className="text-right">P&L ₹</span>
          <span className="text-right">P&L %</span>
          <span className="text-right">SL</span>
          <span className="text-right">Status</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No positions</p>
          <p className="text-caption text-fg-faint">Holdings appear once data is synced.</p>
        </div>
      ) : (
        <div>
          {rows.map((holding) => (
            <PositionRow
              key={`${holding.isin}-${holding.product}`}
              holding={holding}
              status={resolveHoldingStatus(holding, slMap)}
              sl={slMap.get(holding.trading_symbol)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
