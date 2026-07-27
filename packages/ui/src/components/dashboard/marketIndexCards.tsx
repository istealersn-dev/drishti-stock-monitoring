import type React from "react";

import { Card } from "../ui/card";

const PLACEHOLDER = "—";

// Same set the desktop header ticker shows. Placeholder until a market-indices
// endpoint exists — swap for a query when /api/indices lands.
const PLACEHOLDER_INDICES = ["NIFTY 50", "SENSEX", "BANK NIFTY", "INDIA VIX"];

/**
 * Market index cards (updated design) — a row of index tiles above the KPI
 * grid. Renders names with em-dash values until an indices endpoint exists.
 * @returns Index cards row
 */
export function MarketIndexCards(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lap:grid-cols-4">
      {PLACEHOLDER_INDICES.map((name) => (
        <Card key={name} className="flex items-center justify-between gap-2 !py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-caption text-fg-dim">{name}</span>
            <span className="font-mono text-body-sm font-semibold text-fg-soft">{PLACEHOLDER}</span>
          </div>
          <span className="font-mono text-caption text-fg-faint">· {PLACEHOLDER}</span>
        </Card>
      ))}
    </div>
  );
}
