import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Spinner } from "../components/ui/spinner";
import { type GttOrder, type Holding, fetchGttOrders, fetchHoldings } from "../lib/api";

const ONE_LAKH = 100_000;
const MTF_ANNUAL_INTEREST_RATE = 0.18;
const DAYS_IN_YEAR = 365;

function formatInr(amount: number): string {
  if (Math.abs(amount) >= ONE_LAKH) {
    return `₹${(amount / ONE_LAKH).toFixed(1)}L`;
  }
  return `₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type HoldingStatus = {
  variant: "success" | "warning" | "danger";
  label: string;
};

function resolveHoldingStatus(holding: Holding, slMap: Map<string, number>): HoldingStatus {
  const sl = slMap.get(holding.trading_symbol);
  if (sl !== undefined && holding.last_price <= sl) {
    return { variant: "danger", label: "AT SL" };
  }
  if (sl !== undefined && holding.last_price <= sl * 1.05) {
    return { variant: "warning", label: "NEAR SL" };
  }
  return { variant: "success", label: "ACTIVE" };
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

type StatCardProperties = {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent: "indigo" | "success" | "warning" | "danger";
};

function StatCard({ label, value, sub, accent }: StatCardProperties): React.ReactElement {
  return (
    <div className="stat-card">
      <div className={`stat-card-accent stat-card-accent-${accent}`} />
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-sub">{sub}</div>
    </div>
  );
}

const TABLE_HEADERS = [
  { label: "Symbol" },
  { label: "Exch" },
  { label: "Qty", right: true },
  { label: "Avg", right: true },
  { label: "LTP", right: true },
  { label: "P&L ₹", right: true },
  { label: "P&L %", right: true },
  { label: "SL", right: true },
  { label: "Status", right: true },
];

/**
 * Dashboard page — 4 stat cards + holdings overview table.
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

  if (isError) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load portfolio data. Is the agent running?
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-drk space-y-[14px]">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
        <StatCard
          label="Total portfolio value"
          accent="indigo"
          value={formatInr(totalValue)}
          sub={
            <>
              <span className={totalPnlPct >= 0 ? "text-success" : "text-danger"}>
                {totalPnlPct >= 0 ? "+" : ""}
                {totalPnlPct.toFixed(2)}%
              </span>{" "}
              <span>vs cost</span>
            </>
          }
        />

        <StatCard
          label="Unrealised P&L today"
          accent={dayPnl >= 0 ? "success" : "danger"}
          value={
            <span className={dayPnl >= 0 ? "text-success" : "text-danger"}>
              {dayPnlSign}
              {formatInr(Math.abs(dayPnl))}
            </span>
          }
          sub="marked-to-market"
        />

        <StatCard
          label="MTF interest burn"
          accent={mtfBurnPerDay > 0 ? "warning" : "success"}
          value={
            mtfBurnPerDay > 0 ? (
              <>
                <span className="text-warning">{formatInr(mtfBurnPerDay)}</span>
                <span className="text-[13px] font-medium text-[#8a6d2f]">/day</span>
              </>
            ) : (
              <span className="text-text-tertiary">—</span>
            )
          }
          sub={mtfBurnPerDay > 0 ? "@ 18% p.a." : "No MTF positions"}
        />

        <StatCard
          label="Active GTTs"
          accent="success"
          value={<span className="text-success">{gttOrders.length}</span>}
          sub="SL orders live"
        />
      </div>

      {/* Holdings overview table */}
      <div className="holdings-card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-[13px]">
          <span className="text-[13px] font-semibold text-text-primary">Holdings overview</span>
          <span className="font-mono text-[11px] text-text-dim">
            {holdings.length} position{holdings.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ minWidth: 760 }}>
          {/* Column headers */}
          <div className="holdings-col-grid holdings-col-header">
            {TABLE_HEADERS.map((col) => (
              <span key={col.label} className={col.right === true ? "text-right" : ""}>
                {col.label}
              </span>
            ))}
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10">
              <p className="text-[13.5px] font-medium text-text-tertiary">No positions</p>
              <p className="text-[12px] text-text-dim">Holdings will appear once data is synced.</p>
            </div>
          ) : (
            holdings.map((holding) => {
              const status = resolveHoldingStatus(holding, slMap);
              const sl = slMap.get(holding.trading_symbol);
              const pnlColor = holding.pnl >= 0 ? "text-success" : "text-danger";
              const ltpColor =
                holding.last_price >= holding.close_price ? "text-success" : "text-danger";
              const pnlPct =
                holding.average_price > 0
                  ? (holding.pnl / (holding.quantity * holding.average_price)) * 100
                  : 0;

              return (
                <div key={holding.isin} className="holdings-col-grid holdings-data-row">
                  <span className="font-mono text-[13px] font-semibold text-text-primary">
                    {holding.trading_symbol}
                  </span>
                  <span className="text-[11.5px] text-text-tertiary">{holding.exchange}</span>
                  <span className="text-right font-mono text-[12px] text-[#bcbcbc]">
                    {holding.quantity}
                  </span>
                  <span className="text-right font-mono text-[12px] text-[#bcbcbc]">
                    {formatPrice(holding.average_price)}
                  </span>
                  <span className={`text-right font-mono text-[12px] ${ltpColor}`}>
                    {formatPrice(holding.last_price)}
                  </span>
                  <span className={`text-right font-mono text-[12px] ${pnlColor}`}>
                    {holding.pnl >= 0 ? "+" : "−"}
                    {formatInr(Math.abs(holding.pnl))}
                  </span>
                  <span className={`text-right font-mono text-[12px] font-semibold ${pnlColor}`}>
                    {pnlPct >= 0 ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </span>
                  <span className="text-right font-mono text-[12px] text-text-tertiary">
                    {sl !== undefined ? formatPrice(sl) : "—"}
                  </span>
                  <span className="flex justify-end">
                    <span className={`holding-status-badge holding-status-badge-${status.variant}`}>
                      <span className={`holding-status-dot holding-status-dot-${status.variant}`} />
                      {status.label}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {holdingData?.cachedAt != null && (
        <p className="text-[11px] text-text-faint">
          Prices cached at {new Date(holdingData.cachedAt).toLocaleTimeString("en-IN")}
        </p>
      )}
    </div>
  );
}
