import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Spinner } from "../components/ui/spinner";
import { type Underperformer, fetchHealth } from "../lib/api";

const ONE_LAKH = 100_000;

function formatInr(amount: number): string {
  if (Math.abs(amount) >= ONE_LAKH) {
    return `₹${(amount / ONE_LAKH).toFixed(1)}L`;
  }
  return `₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function riskAccent(pct: number): "success" | "warning" | "danger" {
  if (pct >= 15) return "danger";
  if (pct >= 8) return "warning";
  return "success";
}

const UNDERPERFORMER_GRID = "grid grid-cols-[120px_minmax(0,1fr)_90px_90px_80px] items-center px-4";

type UnderperformerRowProperties = {
  underperformer: Underperformer;
};

function UnderperformerRow({ underperformer: u }: UnderperformerRowProperties): React.ReactElement {
  return (
    <div className={`${UNDERPERFORMER_GRID} holdings-data-row`}>
      <span className="font-mono text-[13px] font-semibold text-text-primary">{u.symbol}</span>
      <span className="truncate text-[12px] text-text-tertiary">{u.companyName}</span>
      <span className="text-right font-mono text-[12px] text-[#bcbcbc]">
        {u.buyPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="text-right font-mono text-[12px] text-[#bcbcbc]">
        {u.currentLtp.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
      <span className="text-right font-mono text-[12px] font-semibold text-danger">
        −{Math.abs(u.pctDown).toFixed(1)}%
      </span>
    </div>
  );
}

const UNDERPERFORMER_HEADERS = [
  { label: "Symbol" },
  { label: "Name" },
  { label: "Buy", right: true },
  { label: "LTP", right: true },
  { label: "Down", right: true },
];

/**
 * Portfolio health page — risk stat cards, underperformers table, overdue reviews, and LLM narrative.
 * @returns Health page element
 */
export function Health(): React.ReactElement {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || data == null) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-danger-text">
        Failed to load portfolio health. Is the agent running?
      </div>
    );
  }

  return (
    <div className="animate-fade-drk space-y-[14px]">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-[14px]">
        <StatCard
          label="Portfolio value"
          accent="indigo"
          value={formatInr(data.totalPortfolioValue)}
          sub={`${data.activePositionCount} active position${data.activePositionCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Capital at risk"
          accent={riskAccent(data.capitalAtRiskPct)}
          value={`${data.capitalAtRiskPct.toFixed(1)}%`}
          sub={formatInr(data.totalCapitalAtRisk)}
        />
        <StatCard
          label="MTF interest burn"
          accent={data.mtfBurnRateMonthly > 0 ? "warning" : "success"}
          value={
            data.mtfBurnRateMonthly > 0 ? (
              <>
                <span className="text-warning">{formatInr(data.mtfBurnRateMonthly)}</span>
                <span className="text-[13px] font-medium text-[#8a6d2f]">/mo</span>
              </>
            ) : (
              <span className="text-text-tertiary">—</span>
            )
          }
          sub={data.mtfBurnRateMonthly > 0 ? "monthly run-rate" : "No MTF positions"}
        />
        <StatCard
          label="Overdue for review"
          accent={data.overdueForReview.length > 0 ? "warning" : "success"}
          value={
            <span className={data.overdueForReview.length > 0 ? "text-warning" : "text-success"}>
              {data.overdueForReview.length}
            </span>
          }
          sub="positions"
        />
      </div>

      {/* LLM narrative */}
      <div className="settings-card">
        <div className="mb-2 text-[13px] font-semibold text-text-primary">Health narrative</div>
        <p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-text-secondary">
          {data.llmNarrative}
        </p>
      </div>

      {/* Underperformers */}
      <div className="holdings-card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-[13px]">
          <span className="text-[13px] font-semibold text-text-primary">Underperformers</span>
          <span className="font-mono text-[11px] text-text-dim">
            {data.underperformers.length} flagged
          </span>
        </div>
        <div style={{ minWidth: 720 }}>
          <div className="hp-col-grid holdings-col-header">
            {UNDERPERFORMER_HEADERS.map((col) => (
              <span key={col.label} className={col.right === true ? "text-right" : ""}>
                {col.label}
              </span>
            ))}
          </div>
          {data.underperformers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10">
              <p className="text-[13.5px] font-medium text-text-tertiary">No underperformers</p>
              <p className="text-[12px] text-text-dim">
                All positions are holding above their cost basis.
              </p>
            </div>
          ) : (
            data.underperformers.map((u) => <UnderperformerRow key={u.symbol} underperformer={u} />)
          )}
        </div>
      </div>

      {/* Overdue for review */}
      {data.overdueForReview.length > 0 && (
        <div className="settings-card">
          <div className="mb-2 text-[13px] font-semibold text-text-primary">Overdue for review</div>
          <div className="flex flex-wrap gap-2">
            {data.overdueForReview.map((symbol) => (
              <span
                key={symbol}
                className="rounded-md bg-[rgba(245,158,11,.12)] px-[9px] py-[3px] font-mono text-[12px] text-warning"
              >
                {symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-faint">
        Generated at {new Date(data.generatedAt).toLocaleString("en-IN")}
      </p>
    </div>
  );
}
