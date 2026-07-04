import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { NeedsAttentionCard } from "../components/dashboard/needsAttentionCard";
import { StatCard } from "../components/dashboard/statCard";
import { Badge } from "../components/ui/badge";
import { StatusDot } from "../components/ui/statusDot";
import { Table } from "../components/ui/table";
import { type GttOrder, type Holding, fetchGttOrders, fetchHoldings } from "../lib/api";

const ONE_LAKH = 100_000;
const MTF_ANNUAL_INTEREST_RATE = 0.18;
const DAYS_IN_YEAR = 365;
const NEAR_SL_BAND = 1.05; // within 5% above the SL trigger counts as "near"

function formatInr(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= ONE_LAKH) {
    return `₹${(abs / ONE_LAKH).toFixed(1)}L`;
  }
  return `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type HoldingStatus = {
  variant: "pos" | "warn" | "neg";
  label: string;
};

// "pos" is never actually looked up (needsAttention filters it out before
// sorting) but is listed so the Record stays exhaustive over the full
// HoldingStatus["variant"] union without a type assertion.
const SEVERITY_RANK: Record<HoldingStatus["variant"], number> = { neg: 0, warn: 1, pos: 2 };

function resolveHoldingStatus(holding: Holding, slMap: Map<string, number>): HoldingStatus {
  const sl = slMap.get(holding.trading_symbol);
  if (sl !== undefined && holding.last_price <= sl) {
    return { variant: "neg", label: "AT SL" };
  }
  if (sl !== undefined && holding.last_price <= sl * NEAR_SL_BAND) {
    return { variant: "warn", label: "NEAR SL" };
  }
  return { variant: "pos", label: "ACTIVE" };
}

function buildSlMap(gttOrders: GttOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of gttOrders) {
    if (order.type === "SL" && !map.has(order.symbol)) {
      map.set(order.symbol, order.triggerPrice);
    }
  }
  return map;
}

/**
 * Dashboard (Design.md/handoff.md §3 — "stats + needs-attention") — 4 stat
 * cards, a Needs Attention section (holdings at or within 5% of their GTT
 * stop-loss, breach-first), and the full holdings overview table.
 * @returns Dashboard page element
 */
export function Dashboard(): React.ReactElement {
  const {
    data: holdingData,
    isLoading: holdingsLoading,
    isError: holdingsError,
  } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  const {
    data: gttOrders = [],
    isLoading: gttLoading,
    isError: gttError,
  } = useQuery({
    queryKey: ["gtt", "active"],
    queryFn: () => fetchGttOrders("active"),
  });

  const holdings = holdingData?.holdings ?? [];
  const isLoading = holdingsLoading || gttLoading;
  const isError = holdingsError || gttError;

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.last_price, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const dayPnl = holdings.reduce((sum, h) => sum + h.day_change * h.quantity, 0);
  const mtfValue = holdings
    .filter((h) => h.product === "MTF")
    .reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const mtfBurnPerDay = (mtfValue * MTF_ANNUAL_INTEREST_RATE) / DAYS_IN_YEAR;

  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dayPnlSign = dayPnl >= 0 ? "+" : "−";
  const slMap = buildSlMap(gttOrders);

  // flatMap (not map+filter) so `sl` is proven defined for every surviving
  // entry — resolveHoldingStatus only returns "neg"/"warn" when the SL map
  // has this symbol, so a separate `?? 0` fallback below would be dead code
  // masking that invariant instead of relying on it.
  const needsAttention = holdings
    .flatMap((holding) => {
      const sl = slMap.get(holding.trading_symbol);
      if (sl === undefined) return [];
      const status = resolveHoldingStatus(holding, slMap);
      if (status.variant === "pos") return [];
      return [{ holding, sl, status }];
    })
    .sort((a, b) => SEVERITY_RANK[a.status.variant] - SEVERITY_RANK[b.status.variant]);

  if (isError) {
    return (
      <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
        Failed to load portfolio data. Is the agent running?
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span
          role="status"
          aria-label="Loading"
          className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-gold"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 nav:grid-cols-4">
        <StatCard
          label="Total portfolio value"
          accent="info"
          value={formatInr(totalValue)}
          sub={
            <>
              <span className={totalPnlPct >= 0 ? "text-pos" : "text-neg"}>
                {totalPnlPct >= 0 ? "+" : ""}
                {totalPnlPct.toFixed(2)}%
              </span>{" "}
              vs cost
            </>
          }
        />
        <StatCard
          label="Unrealised P&L today"
          accent={dayPnl >= 0 ? "pos" : "neg"}
          value={
            <span className={dayPnl >= 0 ? "text-pos" : "text-neg"}>
              {dayPnlSign}
              {formatInr(Math.abs(dayPnl))}
            </span>
          }
          sub="marked-to-market"
        />
        <StatCard
          label="MTF interest burn"
          accent={mtfBurnPerDay > 0 ? "warn" : "pos"}
          value={
            mtfBurnPerDay > 0 ? (
              <span className="text-warn">
                {formatInr(mtfBurnPerDay)}
                <span className="text-body-sm font-medium text-fg-muted">/day</span>
              </span>
            ) : (
              <span className="text-fg-muted">—</span>
            )
          }
          sub={mtfBurnPerDay > 0 ? "@ 18% p.a." : "No MTF positions"}
        />
        <StatCard
          label="Active GTTs"
          accent="pos"
          value={<span className="text-pos">{gttOrders.length}</span>}
          sub="SL orders live"
        />
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-title font-semibold text-fg">Needs attention</h2>
          {needsAttention.length > 0 && <Badge variant="warn">{needsAttention.length}</Badge>}
        </div>
        {needsAttention.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface-2 p-4">
            <StatusDot variant="pos" label="All positions safe" pulse={false} />
            <div>
              <p className="text-body-sm font-medium text-fg">All positions safe</p>
              <p className="text-caption text-fg-muted">No holdings near their stop-loss.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 nav:grid-cols-2">
            {needsAttention.map(({ holding, sl, status }) => {
              const pnlPct =
                holding.average_price > 0
                  ? (holding.pnl / (holding.quantity * holding.average_price)) * 100
                  : 0;
              // sl is guaranteed present here (see the flatMap guard above);
              // this guard is only against a malformed sl of exactly 0.
              const distanceToSlPercentage = sl !== 0 ? ((holding.last_price - sl) / sl) * 100 : 0;
              return (
                <NeedsAttentionCard
                  key={`${holding.isin}-${holding.product}`}
                  symbol={holding.trading_symbol}
                  statusLabel={status.label}
                  variant={status.variant === "neg" ? "danger" : "warning"}
                  ltp={holding.last_price}
                  pnlPercentage={pnlPct}
                  sl={sl}
                  distanceToSlPercentage={distanceToSlPercentage}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold text-fg">Holdings overview</h2>
          <span className="font-mono text-caption text-fg-faint">
            {holdings.length} position{holdings.length !== 1 ? "s" : ""}
          </span>
        </div>

        {holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
            <p className="text-body-sm font-medium text-fg-muted">No positions</p>
            <p className="text-caption text-fg-faint">Holdings will appear once data is synced.</p>
          </div>
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Symbol</Table.HeaderCell>
                <Table.HeaderCell>Exch</Table.HeaderCell>
                <Table.HeaderCell align="right">Qty</Table.HeaderCell>
                <Table.HeaderCell align="right">Avg</Table.HeaderCell>
                <Table.HeaderCell align="right">LTP</Table.HeaderCell>
                <Table.HeaderCell align="right">P&amp;L ₹</Table.HeaderCell>
                <Table.HeaderCell align="right">P&amp;L %</Table.HeaderCell>
                <Table.HeaderCell align="right">SL</Table.HeaderCell>
                <Table.HeaderCell align="right">Status</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {holdings.map((holding) => {
                const status = resolveHoldingStatus(holding, slMap);
                const sl = slMap.get(holding.trading_symbol);
                const pnlColor = holding.pnl >= 0 ? "text-pos" : "text-neg";
                const ltpColor =
                  holding.last_price >= holding.close_price ? "text-pos" : "text-neg";
                const pnlPct =
                  holding.average_price > 0
                    ? (holding.pnl / (holding.quantity * holding.average_price)) * 100
                    : 0;

                return (
                  <Table.Row key={holding.isin}>
                    <Table.Cell className="font-mono uppercase">
                      {holding.trading_symbol}
                    </Table.Cell>
                    <Table.Cell>{holding.exchange}</Table.Cell>
                    <Table.Cell numeric>{holding.quantity}</Table.Cell>
                    <Table.Cell numeric>{formatPrice(holding.average_price)}</Table.Cell>
                    <Table.Cell numeric className={ltpColor}>
                      {formatPrice(holding.last_price)}
                    </Table.Cell>
                    <Table.Cell numeric className={pnlColor}>
                      {holding.pnl >= 0 ? "+" : "−"}
                      {formatInr(Math.abs(holding.pnl))}
                    </Table.Cell>
                    <Table.Cell numeric className={pnlColor}>
                      {pnlPct >= 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </Table.Cell>
                    <Table.Cell numeric>{sl !== undefined ? formatPrice(sl) : "—"}</Table.Cell>
                    <Table.Cell align="right">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot variant={status.variant} label={status.label} pulse={false} />
                        <span className="text-caption text-fg-muted">{status.label}</span>
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </section>

      {holdingData?.cachedAt != null && (
        <p className="text-caption text-fg-faint">
          Prices cached at {new Date(holdingData.cachedAt).toLocaleTimeString("en-IN")}
        </p>
      )}
    </div>
  );
}
