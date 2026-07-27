import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import type React from "react";

import { MarketIndexCards } from "../components/dashboard/marketIndexCards";
import { NeedsAttentionCard } from "../components/dashboard/needsAttentionCard";
import { PortfolioTrendCard } from "../components/dashboard/portfolioTrendCard";
import { PositionsSnapshot } from "../components/dashboard/positionsSnapshot";
import { StatCard } from "../components/dashboard/statCard";
import { Spinner } from "../components/ui/spinner";
import { StatusDot } from "../components/ui/statusDot";
import { fetchApprovals, fetchGttOrders, fetchHoldings } from "../lib/api";
import { formatInr } from "../lib/format";
import { sumHoldingsValue } from "../lib/holdingFormat";
import { type HoldingStatus, buildSlMap, resolveHoldingStatus } from "../lib/holdingStatus";

const PLACEHOLDER = "—";

// Breach (neg) sorts before near-SL (warn); pos is filtered out before sorting
// but kept so the map stays exhaustive over the status union.
const SEVERITY_RANK: Record<HoldingStatus["variant"], number> = { neg: 0, warn: 1, pos: 2 };

/**
 * Time-of-day greeting for the dashboard header, matching the updated design's
 * "{greeting} Your book … at a glance." line.
 * @returns A greeting word for the current local hour
 */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

/**
 * Dashboard (updated design) — "Portfolio overview": market index cards, a
 * proposals banner, a KPI row, the portfolio-trend panel, and an expandable
 * positions snapshot. Realised-P&L-today, the trend chart, sector, and the
 * indices are placeholders until their data sources exist.
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

  const { data: approvals = [] } = useQuery({
    queryKey: ["approvals"],
    queryFn: fetchApprovals,
  });

  const holdings = holdingData?.holdings ?? [];
  const isLoading = holdingsLoading || gttLoading;
  const isError = holdingsError || gttError;

  const totalValue = sumHoldingsValue(holdings);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const slMap = buildSlMap(gttOrders);
  const pendingProposals = approvals.filter((approval) => approval.status === "pending").length;

  // Holdings at or within 5% of their stop-loss, breach-first — the mobile
  // dashboard's focus (desktop conveys the same via the positions Status
  // column). flatMap so `sl` is proven defined for each surviving entry.
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
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-semibold tracking-tight text-fg">Portfolio overview</h1>
          <p className="text-body-sm text-fg-muted">
            {greeting()} Your book, open orders and today&apos;s activity at a glance.
          </p>
        </div>
        {holdingData?.cachedAt != null && (
          <span className="font-mono text-caption text-fg-faint">
            last poll {new Date(holdingData.cachedAt).toLocaleTimeString("en-IN")}
          </span>
        )}
      </div>

      <MarketIndexCards />

      {pendingProposals > 0 && (
        <Link
          to="/instructions"
          className="flex items-center gap-3 rounded-xl border border-warn-ring bg-warn-tint px-4 py-3 transition-colors hover:brightness-110"
        >
          <Bell aria-hidden="true" className="h-4 w-4 flex-none text-warn" />
          <span className="flex-1 text-body-sm text-fg">
            Drishti has{" "}
            <b className="font-semibold text-warn">
              {pendingProposals} proposal{pendingProposals !== 1 ? "s" : ""}
            </b>{" "}
            waiting for your approval.
          </span>
          <span className="flex flex-none items-center gap-1 font-mono text-caption text-warn">
            Review <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3.5 lap:grid-cols-4">
        <StatCard
          label="Total portfolio value"
          accent="gold"
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
          label="Unrealised P&L"
          accent={totalPnl >= 0 ? "pos" : "neg"}
          value={
            <span className={totalPnl >= 0 ? "text-pos" : "text-neg"}>
              {totalPnl >= 0 ? "+" : "−"}
              {formatInr(Math.abs(totalPnl))}
            </span>
          }
          sub="open positions · MTM"
        />
        <StatCard
          label="Realised P&L today"
          accent="info"
          value={<span className="text-fg-muted">{PLACEHOLDER}</span>}
          sub="today's trades not tracked yet"
        />
        <StatCard
          label="Open orders"
          accent="pos"
          value={<span className="text-pos">{gttOrders.length}</span>}
          sub={`${gttOrders.length} active · ${PLACEHOLDER} triggered`}
        />
      </div>

      <PortfolioTrendCard />

      {/* Positions live in a wide table on desktop; the mobile dashboard
          focuses on at-risk holdings and sends the full list to Holdings. */}
      <div className="hidden tab:block">
        <PositionsSnapshot holdings={holdings} slMap={slMap} />
      </div>

      <section className="flex flex-col gap-2.5 tab:hidden">
        <h2 className="text-title font-semibold text-fg">Needs attention</h2>
        {needsAttention.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface-2 p-4">
            <StatusDot variant="pos" label="All positions safe" pulse={false} />
            <div>
              <p className="text-body-sm font-medium text-fg">All positions safe</p>
              <p className="text-caption text-fg-muted">No holdings near their stop-loss.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {needsAttention.map(({ holding, sl, status }) => {
              const cost = holding.quantity * holding.average_price;
              const pnlPct = cost > 0 ? (holding.pnl / cost) * 100 : 0;
              const distanceToSl = sl !== 0 ? ((holding.last_price - sl) / sl) * 100 : 0;
              return (
                <NeedsAttentionCard
                  key={`${holding.isin}-${holding.product}`}
                  symbol={holding.trading_symbol}
                  statusLabel={status.label}
                  variant={status.variant === "neg" ? "danger" : "warning"}
                  ltp={holding.last_price}
                  pnlPercentage={pnlPct}
                  sl={sl}
                  distanceToSlPercentage={distanceToSl}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
