import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { fetchHoldings, type Holding } from "../lib/api";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function pnlVariant(value: number): "success" | "danger" | "default" {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "default";
}

/**
 * Holdings page — full holdings table with live prices, P&L, and product badges.
 * @returns Holdings page element
 */
export function Holdings(): React.ReactElement {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  const holdings = data?.holdings ?? [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load holdings. Is the agent running?
      </div>
    );
  }

  return (
    <div className="animate-fade-drk space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-text-primary">Holdings</h1>
        {data?.cachedAt && (
          <span className="text-[11px] text-text-faint">
            Cached {new Date(data.cachedAt).toLocaleTimeString("en-IN")}
          </span>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-card border border-border-default text-text-muted">
          No holdings found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-surface">
                <th className="table-row-header px-4">Symbol</th>
                <th className="table-row-header px-4 text-right">Qty</th>
                <th className="table-row-header px-4 text-right">Avg</th>
                <th className="table-row-header px-4 text-right">LTP</th>
                <th className="table-row-header px-4 text-right">Day</th>
                <th className="table-row-header px-4 text-right">P&L</th>
                <th className="table-row-header px-4">Product</th>
                <th className="table-row-header px-4">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h: Holding) => (
                <tr key={h.isin} className="table-row-data bg-bg-card hover:bg-bg-hover">
                  <td className="px-4">
                    <p className="font-medium text-text-primary">{h.trading_symbol}</p>
                    <p className="text-[11px] text-text-muted">{h.company_name}</p>
                  </td>
                  <td className="px-4 text-right font-mono">{h.quantity}</td>
                  <td className="px-4 text-right font-mono">{formatInr(h.average_price)}</td>
                  <td className="px-4 text-right font-mono font-medium text-text-primary">
                    {formatInr(h.last_price)}
                  </td>
                  <td
                    className={`px-4 text-right font-mono ${h.day_change_percentage >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatPct(h.day_change_percentage)}
                  </td>
                  <td className="px-4 text-right">
                    <Badge variant={pnlVariant(h.pnl)}>{formatInr(h.pnl)}</Badge>
                  </td>
                  <td className="px-4">
                    <Badge variant={h.product === "MTF" ? "warning" : "default"}>{h.product}</Badge>
                  </td>
                  <td className="px-4">
                    <span className="text-[12px] text-text-muted">{h.exchange}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
