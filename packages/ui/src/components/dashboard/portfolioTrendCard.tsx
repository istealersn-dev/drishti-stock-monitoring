import { TrendingUp } from "lucide-react";
import type React from "react";

import { Card } from "../ui/card";

/**
 * Portfolio trend card (updated design) — an area-chart panel of portfolio
 * value over time. The agent doesn't persist a portfolio-value time series
 * yet, so this renders the framed empty state; wiring is a query swap once a
 * history endpoint exists. Kept as its own component so that swap is local.
 * @returns Portfolio trend card
 */
export function PortfolioTrendCard(): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-body-sm font-semibold text-fg">Portfolio trend</span>
        <span className="font-mono text-micro uppercase tracking-wide text-fg-faint">
          history coming soon
        </span>
      </div>
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2">
        <TrendingUp aria-hidden="true" className="h-6 w-6 text-fg-ghost" />
        <p className="text-caption text-fg-muted">
          Trend chart appears once value history is recorded.
        </p>
      </div>
    </Card>
  );
}
