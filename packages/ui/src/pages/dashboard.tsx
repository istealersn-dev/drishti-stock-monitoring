import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import type React from "react";

import { MarketIndexCards } from "../components/dashboard/marketIndexCards";
import { NeedsAttentionList } from "../components/dashboard/needsAttentionList";
import { OpenOrdersCard } from "../components/dashboard/openOrdersCard";
import { PortfolioTrendCard } from "../components/dashboard/portfolioTrendCard";
import { PositionsSnapshot } from "../components/dashboard/positionsSnapshot";
import { StatCard } from "../components/dashboard/statCard";
import { TodaysActivityCard } from "../components/dashboard/todaysActivityCard";
import { Spinner } from "../components/ui/spinner";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { fetchApprovals, fetchGttOrders, fetchHoldings } from "../lib/api";
import { filterPendingApprovals } from "../lib/approvals";
import { PLACEHOLDER, formatInr, formatSignedInr } from "../lib/format";
import { sumHoldingsValue } from "../lib/holdingFormat";
import { buildSlMap } from "../lib/holdingStatus";
import { timeOfDayGreeting } from "../lib/timeOfDayGreeting";

const MTF_ANNUAL_INTEREST_RATE = 0.18;
const DAYS_IN_YEAR = 365;

/**
 * Dashboard (updated design) — "Portfolio overview": market index cards, a
 * pending-approvals banner, a KPI row, the portfolio-trend panel, an expandable
 * positions snapshot, and the open-orders and today's-activity panels. Mobile
 * swaps the snapshot for a Needs attention list above the trend. Realised
 * P&L, trades, triggered GTTs, the trend chart, sector, and the indices are
 * placeholders until their data sources exist.
 * @returns Dashboard page element
 */
export function Dashboard(): React.ReactElement {
  const isDesktop = useIsDesktop();
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

  const { data: approvals = [], isError: approvalsError } = useQuery({
    queryKey: ["approvals"],
    queryFn: fetchApprovals,
  });

  // Closed-out rows linger in the feed with no real exposure, so nothing here
  // counts them.
  const holdings = (holdingData?.holdings ?? []).filter((holding) => holding.quantity > 0);
  const isLoading = holdingsLoading || gttLoading;
  const isError = holdingsError || gttError;

  const totalValue = sumHoldingsValue(holdings);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dayPnl = holdings.reduce((sum, h) => sum + h.day_change * h.quantity, 0);
  const mtfValue = holdings
    .filter((h) => h.product === "MTF")
    .reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const mtfBurnPerDay = (mtfValue * MTF_ANNUAL_INTEREST_RATE) / DAYS_IN_YEAR;
  const slMap = buildSlMap(gttOrders);
  const pendingApprovals = filterPendingApprovals(approvals).length;

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
            {timeOfDayGreeting()}{" "}
            {isDesktop
              ? "Your book, open orders and today's activity at a glance."
              : "Your book at a glance."}
          </p>
        </div>
        {holdingData?.cachedAt != null && (
          <span className="font-mono text-caption text-fg-faint">
            prices as of {new Date(holdingData.cachedAt).toLocaleTimeString("en-IN")}
          </span>
        )}
      </div>

      <MarketIndexCards />

      {approvalsError && (
        <div className="rounded-xl border border-neg-ring bg-neg-tint px-4 py-3 text-body-sm text-neg">
          {approvals.length === 0
            ? "Couldn't check for pending approvals. "
            : "Couldn't refresh approvals, so this count may be out of date. "}
          <Link to="/instructions" className="underline">
            Open Approvals
          </Link>
        </div>
      )}

      {pendingApprovals > 0 && (
        <Link
          to="/instructions"
          className="flex items-center gap-3 rounded-xl border border-warn-ring bg-warn-tint px-4 py-3 transition-colors hover:brightness-110"
        >
          <Bell aria-hidden="true" className="h-4 w-4 flex-none text-warn" />
          <span className="flex-1 text-body-sm text-fg">
            You have{" "}
            <b className="font-semibold text-warn">
              {pendingApprovals} instruction{pendingApprovals !== 1 ? "s" : ""}
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
          label={isDesktop ? "Total portfolio value" : "Portfolio value"}
          accent="gold"
          value={formatInr(totalValue)}
          sub={
            <>
              <span className={totalPnlPct >= 0 ? "text-pos" : "text-neg"}>
                {totalPnlPct >= 0 ? "+" : ""}
                {totalPnlPct.toFixed(2)}%
              </span>{" "}
              vs cost{mtfBurnPerDay > 0 && ` · ${formatInr(mtfBurnPerDay)}/day MTF`}
            </>
          }
        />
        <StatCard
          label="Unrealised P&L"
          accent={totalPnl >= 0 ? "pos" : "neg"}
          value={
            <span className={totalPnl >= 0 ? "text-pos" : "text-neg"}>
              {formatSignedInr(totalPnl)}
            </span>
          }
          sub={
            <>
              <span className={dayPnl >= 0 ? "text-pos" : "text-neg"}>
                {formatSignedInr(dayPnl)}
              </span>{" "}
              today · MTM
            </>
          }
        />
        <StatCard
          label={isDesktop ? "Realised P&L today" : "Realised today"}
          accent="info"
          value={<span className="text-fg-muted">{PLACEHOLDER}</span>}
          sub="today's trades not tracked yet"
        />
        <StatCard
          label="Open orders"
          accent="pos"
          value={<span className="text-pos">{gttOrders.length}</span>}
          sub={
            isDesktop
              ? `${gttOrders.length} active · ${PLACEHOLDER} triggered`
              : `${gttOrders.length} active`
          }
        />
      </div>

      {/* Desktop's table leads with every at-risk holding, so it sits above the
          trend; mobile gets the at-risk list and leaves the rest to Holdings. */}
      {isDesktop ? (
        <PositionsSnapshot holdings={holdings} slMap={slMap} />
      ) : (
        <NeedsAttentionList holdings={holdings} slMap={slMap} />
      )}

      <PortfolioTrendCard />

      <div className="grid grid-cols-1 items-start gap-3.5 lap:grid-cols-2">
        <OpenOrdersCard orders={gttOrders} />
        <TodaysActivityCard />
      </div>
    </div>
  );
}
