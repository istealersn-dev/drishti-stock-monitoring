import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";

import type { Holding } from "../../lib/api";
import { PLACEHOLDER, formatPriceOrDash, formatSignedInr } from "../../lib/format";
import { formatPrice, ltpDirectionArrow } from "../../lib/holdingFormat";
import { type RankedPosition, type SortDirection, rankPositions } from "../../lib/rankPositions";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { StatusDot } from "../ui/statusDot";
import { Table } from "../ui/table";

const COLUMN_COUNT = 9;

// Pinned so a row's status stays in view when the table scrolls sideways on
// narrow widths: this is desktop's only list of at-risk holdings.
const STATUS_CELL = "sticky right-0";

const NEXT_SORT: Record<SortDirection, SortDirection> = { none: "desc", desc: "asc", asc: "none" };
const SORT_ARROW: Record<SortDirection, string> = { none: "↕", desc: "↓", asc: "↑" };
const SORT_LABEL: Record<SortDirection, string> = {
  none: "riskiest first",
  desc: "highest first within each risk level",
  asc: "lowest first within each risk level",
};
const ARIA_SORT: Record<SortDirection, "none" | "ascending" | "descending"> = {
  none: "none",
  desc: "descending",
  asc: "ascending",
};

/**
 * One expandable position row: a summary row and, when open, a detail row
 * (SL threshold, target, distance-to-SL, margin product, exchange). The whole
 * row is a click target for mouse users; the symbol button is the keyboard and
 * screen-reader control.
 * @param props.position - The ranked position to render
 * @param props.target - The holding's first target, where one is set
 * @returns Position rows
 */
function PositionRow({
  position,
  target,
}: {
  position: RankedPosition;
  target: number | undefined;
}): React.ReactElement {
  const { holding, status, sl, pnlPct, distanceToSl } = position;
  const [expanded, setExpanded] = useState(false);
  const pnlColor = holding.pnl >= 0 ? "!text-pos" : "!text-neg";
  const ltpColor = holding.last_price >= holding.close_price ? "!text-pos" : "!text-neg";

  return (
    <>
      <Table.Row
        className="group cursor-pointer"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
      >
        <Table.Cell>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${holding.trading_symbol} details`}
            className="flex min-h-6 cursor-pointer items-center gap-1.5 font-mono uppercase text-fg"
          >
            <ChevronRight
              aria-hidden="true"
              className={`h-3.5 w-3.5 flex-none text-fg-faint transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {holding.trading_symbol}
          </button>
        </Table.Cell>
        <Table.Cell className="text-caption !text-fg-dim">{PLACEHOLDER}</Table.Cell>
        <Table.Cell numeric className="text-caption !text-fg-muted">
          {holding.quantity}
        </Table.Cell>
        <Table.Cell numeric className="text-caption !text-fg-muted">
          {formatPrice(holding.average_price)}
        </Table.Cell>
        <Table.Cell numeric className={ltpColor}>
          <span aria-hidden="true">
            {ltpDirectionArrow(holding.last_price, holding.close_price)}
          </span>{" "}
          {formatPrice(holding.last_price)}
        </Table.Cell>
        <Table.Cell numeric className={pnlColor}>
          {formatSignedInr(holding.pnl)}
        </Table.Cell>
        <Table.Cell numeric className={`text-caption ${pnlColor}`}>
          {pnlPct >= 0 ? "+" : ""}
          {pnlPct.toFixed(2)}%
        </Table.Cell>
        <Table.Cell numeric className="text-caption !text-fg-muted">
          {formatPriceOrDash(sl ?? null)}
        </Table.Cell>
        <Table.Cell
          align="right"
          className={`${STATUS_CELL} bg-surface group-hover:bg-surface-hover`}
        >
          <span className="inline-flex items-center gap-1.5">
            {status.variant !== "none" && (
              <StatusDot variant={status.variant} label={status.label} pulse={false} />
            )}
            <span className="text-caption text-fg-muted">{status.label}</span>
          </span>
        </Table.Cell>
      </Table.Row>

      {expanded && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={COLUMN_COUNT} className="bg-surface-2 p-0">
            {/* Pinned to the visible width: the row scrolls sideways when narrow. */}
            <dl className="sticky left-0 grid w-[100cqw] grid-cols-2 gap-x-6 gap-y-2.5 px-9 py-3.5 @3xl:grid-cols-5">
              <Detail term="SL threshold" value={formatPriceOrDash(sl ?? null)} />
              <Detail term="Target price" value={formatPriceOrDash(target ?? null)} />
              <Detail
                term="Distance to SL"
                value={distanceToSl !== undefined ? `${distanceToSl.toFixed(1)}%` : PLACEHOLDER}
              />
              <Detail term="Margin product" value={holding.product} />
              <Detail term="Exchange" value={holding.exchange} />
            </dl>
          </td>
        </tr>
      )}
    </>
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

type PositionsSnapshotProperties = {
  holdings: Holding[];
  slMap: Map<string, number>;
  targetMap: Map<string, number>;
};

/**
 * Positions snapshot (updated design) — a compact, expandable holdings table
 * for the dashboard. Each row expands to show SL/target/exchange detail; a
 * "View all" link goes to the full Holdings page, and the P&L % header cycles
 * the sort. Sector and target are placeholders until their data sources exist.
 * @param props.holdings - Current holdings
 * @param props.slMap - Symbol -> stop-loss threshold, for status + SL columns
 * @param props.targetMap - Symbol -> first target, for the expanded detail
 * @returns Positions snapshot card
 */
export function PositionsSnapshot({
  holdings,
  slMap,
  targetMap,
}: PositionsSnapshotProperties): React.ReactElement {
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const { rows, atRiskCount, noSlCount } = rankPositions(holdings, slMap, sortDirection);

  return (
    <Card className="flex flex-col gap-0 overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-body-sm font-semibold text-fg">Positions snapshot</h2>
          {atRiskCount > 0 && <Badge variant="warn">{atRiskCount} at risk</Badge>}
          {noSlCount > 0 && <Badge variant="neutral">{noSlCount} no SL</Badge>}
        </div>
        <Link
          to="/holdings"
          className="inline-flex min-h-6 items-center font-mono text-caption text-gold transition-colors hover:text-gold-bright"
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
        <Table className="min-w-[56rem]" wrapperClassName="@container">
          <Table.Head>
            <Table.Row className="bg-surface-2 hover:!bg-surface-2">
              <Table.HeaderCell className="pl-8">Symbol</Table.HeaderCell>
              <Table.HeaderCell>Sector</Table.HeaderCell>
              <Table.HeaderCell align="right">Qty</Table.HeaderCell>
              <Table.HeaderCell align="right">Avg</Table.HeaderCell>
              <Table.HeaderCell align="right">LTP</Table.HeaderCell>
              <Table.HeaderCell align="right">P&L ₹</Table.HeaderCell>
              <Table.HeaderCell align="right" ariaSort={ARIA_SORT[sortDirection]}>
                <button
                  type="button"
                  onClick={() => {
                    setSortDirection((previous) => NEXT_SORT[previous]);
                  }}
                  aria-label={`P&L %, ${SORT_LABEL[sortDirection]}. Change sort`}
                  className="inline-flex min-h-6 cursor-pointer items-center justify-end gap-1 uppercase transition-colors hover:text-gold-bright"
                >
                  P&L %<span aria-hidden="true">{SORT_ARROW[sortDirection]}</span>
                </button>
              </Table.HeaderCell>
              <Table.HeaderCell align="right">SL</Table.HeaderCell>
              <Table.HeaderCell align="right" className={`${STATUS_CELL} bg-surface-2`}>
                Status
              </Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((position) => (
              <PositionRow
                key={`${position.holding.isin}-${position.holding.product}`}
                target={targetMap.get(position.holding.trading_symbol)}
                position={position}
              />
            ))}
          </Table.Body>
        </Table>
      )}
    </Card>
  );
}
