import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { StatCard } from "../components/dashboard/statCard";
import { PageHeader } from "../components/shell/pageHeader";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { Table } from "../components/ui/table";
import { type Underperformer, fetchHealth } from "../lib/api";
import { formatInr } from "../lib/format";
import { formatPrice } from "../lib/holdingFormat";

function riskAccent(pct: number): "pos" | "warn" | "neg" {
  if (pct >= 15) return "neg";
  if (pct >= 8) return "warn";
  return "pos";
}

type UnderperformerRowProperties = {
  underperformer: Underperformer;
};

function UnderperformerRow({ underperformer }: UnderperformerRowProperties): React.ReactElement {
  return (
    <Table.Row>
      <Table.Cell className="font-mono uppercase">{underperformer.symbol}</Table.Cell>
      <Table.Cell className="max-w-xs truncate">{underperformer.companyName}</Table.Cell>
      <Table.Cell numeric>{formatPrice(underperformer.buyPrice)}</Table.Cell>
      <Table.Cell numeric>{formatPrice(underperformer.currentLtp)}</Table.Cell>
      <Table.Cell numeric className="font-semibold text-neg">
        −{Math.abs(underperformer.pctDown).toFixed(1)}%
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * Portfolio health page (Phase 7) — risk stat cards, an LLM-generated
 * narrative, an underperformers table, and symbols overdue for review.
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
        <Spinner />
      </div>
    );
  }

  if (isError || data == null) {
    return (
      <div className="rounded-xl border border-neg-ring bg-neg-tint p-4 text-body-sm text-neg">
        Failed to load portfolio health. Is the agent running?
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Health"
        subtitle="Portfolio risk, underperformers, and review-overdue positions."
      />
      <div className="grid grid-cols-2 gap-3.5 nav:grid-cols-4">
        <StatCard
          label="Portfolio value"
          accent="info"
          value={formatInr(data.totalPortfolioValue)}
          sub={`${String(data.activePositionCount)} active position${data.activePositionCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Capital at risk"
          accent={riskAccent(data.capitalAtRiskPct)}
          value={`${data.capitalAtRiskPct.toFixed(1)}%`}
          sub={formatInr(data.totalCapitalAtRisk)}
        />
        <StatCard
          label="MTF interest burn"
          accent={data.mtfBurnRateMonthly > 0 ? "warn" : "pos"}
          value={
            data.mtfBurnRateMonthly > 0 ? (
              <span className="text-warn">
                {formatInr(data.mtfBurnRateMonthly)}
                <span className="text-body-sm font-medium text-fg-muted">/mo</span>
              </span>
            ) : (
              <span className="text-fg-muted">—</span>
            )
          }
          sub={data.mtfBurnRateMonthly > 0 ? "monthly run-rate" : "No MTF positions"}
        />
        <StatCard
          label="Overdue for review"
          accent={data.overdueForReview.length > 0 ? "warn" : "pos"}
          value={
            <span className={data.overdueForReview.length > 0 ? "text-warn" : "text-pos"}>
              {data.overdueForReview.length}
            </span>
          }
          sub="positions"
        />
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="text-body-sm font-semibold text-fg">Health narrative</h2>
        <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-fg-muted">
          {data.llmNarrative}
        </p>
      </Card>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold text-fg">Underperformers</h2>
          <span className="font-mono text-caption text-fg-faint">
            {data.underperformers.length} flagged
          </span>
        </div>

        {data.underperformers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 py-10">
            <p className="text-body-sm font-medium text-fg-muted">No underperformers</p>
            <p className="text-caption text-fg-faint">
              All positions are holding above their cost basis.
            </p>
          </div>
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Symbol</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell align="right">Buy</Table.HeaderCell>
                <Table.HeaderCell align="right">LTP</Table.HeaderCell>
                <Table.HeaderCell align="right">Down</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {data.underperformers.map((underperformer) => (
                <UnderperformerRow key={underperformer.symbol} underperformer={underperformer} />
              ))}
            </Table.Body>
          </Table>
        )}
      </section>

      {data.overdueForReview.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-body-sm font-semibold text-fg">Overdue for review</h2>
          <div className="flex flex-wrap gap-2">
            {data.overdueForReview.map((symbol) => (
              <Badge key={symbol} variant="warn">
                {symbol}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <p className="text-caption text-fg-faint">
        Generated at {new Date(data.generatedAt).toLocaleString("en-IN")}
      </p>
    </div>
  );
}
