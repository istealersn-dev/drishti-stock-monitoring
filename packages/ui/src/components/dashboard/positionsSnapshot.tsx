import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";

import type { Holding } from "../../lib/api";
import { PLACEHOLDER, formatSignedInr } from "../../lib/format";
import {
  distanceToSlPercentage,
  formatPrice,
  ltpDirectionArrow,
  pnlPercentage,
} from "../../lib/holdingFormat";
import {
  HOLDING_SEVERITY_RANK,
  type HoldingStatus,
  resolveHoldingStatus,
} from "../../lib/holdingStatus";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { StatusDot } from "../ui/statusDot";

// Shared grid template so the header row and every position row align.
// minmax(0, …) stops a long value from widening its own row's track, which
// would shift that row's columns out from under the headers.
const ROW_GRID =
  "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]";

const DEFAULT_ROW_LIMIT = 5;

// Pinned so a row's status stays in view when the table scrolls sideways on
// narrow widths: this is desktop's only list of at-risk holdings.
const STATUS_CELL = "sticky right-0";

type SortDirection = "none" | "desc" | "asc";

const NEXT_SORT: Record<SortDirection, SortDirection> = { none: "desc", desc: "asc", asc: "none" };
const SORT_ARROW: Record<SortDirection, string> = { none: "↕", desc: "↓", asc: "↑" };
const SORT_LABEL: Record<SortDirection, string> = {
  none: "riskiest first",
  desc: "highest first within each risk level",
  asc: "lowest first within each risk level",
};

type PositionsSnapshotProperties = {
  holdings: Holding[];
  slMap: Map<string, number>;
};

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
  const distanceToSl = distanceToSlPercentage(holding, sl);
  const rowLabel = [
    holding.trading_symbol,
    `quantity ${holding.quantity}`,
    `average ${formatPrice(holding.average_price)}`,
    `last price ${formatPrice(holding.last_price)}`,
    `P&L ${pct.toFixed(2)}%`,
    `stop-loss ${sl !== undefined ? formatPrice(sl) : "not set"}`,
    status.label,
  ].join(", ");

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
        aria-expanded={expanded}
        aria-label={rowLabel}
        className={`group grid w-full ${ROW_GRID} items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover`}
      >
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-body-sm uppercase text-fg">
          <ChevronRight
            aria-hidden="true"
            className={`h-3.5 w-3.5 flex-none text-fg-faint transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          <span className="truncate">{holding.trading_symbol}</span>
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
          {formatSignedInr(holding.pnl)}
        </span>
        <span className={`text-right font-mono text-caption ${pnlColor}`}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
        <span className="text-right font-mono text-caption text-fg-muted">
          {sl !== undefined ? formatPrice(sl) : PLACEHOLDER}
        </span>
        <span
          className={`${STATUS_CELL} flex items-center justify-end gap-1.5 bg-surface group-hover:bg-surface-hover`}
        >
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
 * "View all" link goes to the full Holdings page, and the P&L % header cycles
 * the sort. Sector and target are placeholders until their data sources exist.
 * @param props.holdings - Current holdings
 * @param props.slMap - Symbol -> stop-loss threshold, for status + SL columns
 * @returns Positions snapshot card
 */
export function PositionsSnapshot({
  holdings,
  slMap,
}: PositionsSnapshotProperties): React.ReactElement {
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const positions = holdings.map((holding) => {
    const status = resolveHoldingStatus(holding, slMap);
    const sl = slMap.get(holding.trading_symbol);
    return {
      holding,
      status,
      sl,
      severity: HOLDING_SEVERITY_RANK[status.variant],
      pnlPct: pnlPercentage(holding),
      distanceToSl: distanceToSlPercentage(holding, sl) ?? Number.POSITIVE_INFINITY,
    };
  });
  const atRiskCount = positions.filter(({ status }) => status.variant !== "pos").length;
  // Severity always wins, with the P&L sort or distance to SL inside it, and
  // every at-risk row shows regardless of the limit: Needs attention is
  // mobile-only, so this is desktop's only list of them.
  const sorted = [...positions].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity;
    if (sortDirection === "none") return a.distanceToSl - b.distanceToSl;
    return sortDirection === "desc" ? b.pnlPct - a.pnlPct : a.pnlPct - b.pnlPct;
  });
  const rows = sorted.slice(0, Math.max(DEFAULT_ROW_LIMIT, atRiskCount));

  return (
    <Card className="flex flex-col gap-0 overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-semibold text-fg">Positions snapshot</span>
          {atRiskCount > 0 && <Badge variant="warn">{atRiskCount} at risk</Badge>}
        </div>
        <Link
          to="/holdings"
          className="font-mono text-caption text-gold transition-colors hover:text-gold-bright"
        >
          View all {holdings.length} ›
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-10">
          <p className="text-body-sm font-medium text-fg-muted">No positions</p>
          <p className="text-caption text-fg-faint">Holdings appear once data is synced.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[48rem]">
            <div
              className={`grid ${ROW_GRID} items-center gap-2 border-b border-border bg-surface-2 px-3 py-2 text-micro uppercase tracking-wide text-fg-faint`}
            >
              <span className="pl-5">Symbol</span>
              <span>Sector</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Avg</span>
              <span className="text-right">LTP</span>
              <span className="text-right">P&L ₹</span>
              <button
                type="button"
                onClick={() => {
                  setSortDirection((previous) => NEXT_SORT[previous]);
                }}
                aria-label={`P&L %, ${SORT_LABEL[sortDirection]}. Change sort`}
                className="flex cursor-pointer items-center justify-end gap-1 uppercase transition-colors hover:text-gold-bright"
              >
                P&L %<span aria-hidden="true">{SORT_ARROW[sortDirection]}</span>
              </button>
              <span className="text-right">SL</span>
              <span className={`${STATUS_CELL} bg-surface-2 text-right`}>Status</span>
            </div>
            {rows.map(({ holding, status, sl }) => (
              <PositionRow
                key={`${holding.isin}-${holding.product}`}
                holding={holding}
                status={status}
                sl={sl}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
