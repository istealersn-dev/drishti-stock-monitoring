import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { fetchHoldings, fetchGttOrders, fetchRuns } from "../lib/api";

const ONE_LAKH = 100_000;
const MTF_ANNUAL_INTEREST_RATE = 0.18;
const DAYS_IN_YEAR = 365;

function formatInr(amount: number): string {
  if (Math.abs(amount) >= ONE_LAKH) {
    return `₹${(amount / ONE_LAKH).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * Dashboard page — portfolio summary cards and last agent run status.
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

  const { data: runs = [] } = useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
  });

  const holdings = holdingData?.holdings ?? [];
  const isLoading = holdingsLoading || gttLoading;
  const isError = holdingsError || gttError;

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.last_price, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const dayPnl = holdings.reduce((sum, h) => sum + h.day_change * h.quantity, 0);
  const mtfHoldings = holdings.filter((h) => h.product === "MTF");
  const mtfValue = mtfHoldings.reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  const mtfBurn = Number(((mtfValue * MTF_ANNUAL_INTEREST_RATE) / DAYS_IN_YEAR).toFixed(2));

  const lastRun = runs[0];

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
    <div className="animate-fade-drk space-y-4">
      <h1 className="text-[17px] font-semibold text-text-primary">Dashboard</h1>

      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <Card accent="indigo">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Portfolio Value
          </p>
          <p className="mt-1.5 text-[22px] font-semibold text-text-primary">
            {formatInr(totalValue)}
          </p>
          <p className="mt-0.5 text-[12px] text-text-tertiary">
            {holdings.length} holding{holdings.length !== 1 ? "s" : ""}
          </p>
        </Card>

        <Card accent={dayPnl >= 0 ? "success" : "danger"}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Day P&L
          </p>
          <p
            className={`mt-1.5 text-[22px] font-semibold ${dayPnl >= 0 ? "text-success" : "text-danger"}`}
          >
            {dayPnl >= 0 ? "+" : ""}
            {formatInr(dayPnl)}
          </p>
          <p
            className={`mt-0.5 text-[12px] ${totalPnl >= 0 ? "text-success-text" : "text-danger-text"}`}
          >
            Total {totalPnl >= 0 ? "+" : ""}
            {formatInr(totalPnl)}
          </p>
        </Card>

        <Card accent={mtfBurn > 0 ? "warning" : "none"}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            MTF Burn
          </p>
          <p
            className={`mt-1.5 text-[22px] font-semibold ${mtfBurn > 0 ? "text-warning" : "text-text-tertiary"}`}
          >
            {mtfBurn > 0 ? formatInr(mtfBurn) : "—"}
          </p>
          <p className="mt-0.5 text-[12px] text-text-tertiary">
            {mtfBurn > 0 ? "/day @ 18% p.a." : "No MTF positions"}
          </p>
        </Card>

        <Card accent="success">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Active GTTs
          </p>
          <p className="mt-1.5 text-[22px] font-semibold text-success">{gttOrders.length}</p>
          <p className="mt-0.5 text-[12px] text-text-tertiary">SL orders live</p>
        </Card>
      </div>

      {lastRun && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-text-secondary">Last Agent Run</p>
            <Badge
              variant={
                lastRun.status === "completed"
                  ? "success"
                  : lastRun.status === "failed"
                    ? "danger"
                    : "default"
              }
            >
              {lastRun.status}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-[12px] text-text-muted">
            {new Date(lastRun.startedAt).toLocaleString("en-IN")}
          </p>
          {lastRun.summary && (
            <p className="mt-1 text-[12px] text-text-tertiary">{lastRun.summary}</p>
          )}
        </Card>
      )}

      {holdingData?.cachedAt && (
        <p className="text-[11px] text-text-faint">
          Prices cached at {new Date(holdingData.cachedAt).toLocaleTimeString("en-IN")}
        </p>
      )}
    </div>
  );
}
