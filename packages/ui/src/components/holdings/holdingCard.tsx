import type React from "react";

import type { Holding } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

import { useHoldingGttForm } from "./useHoldingGttForm";

function formatPrice(price: number): string {
  return price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPnl(pnl: number, cost: number): string {
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  const sign = pnl >= 0 ? "+" : "−";
  const absString = Math.abs(pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return `${sign}₹${absString} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
}

function productBadgeVariant(product: string): "warn" | "info" | "neutral" {
  if (product === "MTF") return "warn";
  if (product === "CNC") return "info";
  return "neutral";
}

type HoldingCardProperties = {
  holding: Holding;
};

/**
 * Mobile holding card (handoff.md §4 `HoldingCard.tsx`, layout ported from
 * `Drishti.dc.html`'s mobile holdings list) — the same 10 fields as
 * `HoldingsTable`'s columns, reflowed into stacked rows instead of a table.
 * Shares `useHoldingGttForm` with the desktop table so the two presentations
 * can't drift in behavior.
 * @param props.holding - the holding to render
 * @returns Holding card element
 */
export function HoldingCard({ holding }: HoldingCardProperties): React.ReactElement {
  const { sl, setSl, target, setTarget, saveError, isPending, handleSetGtt } = useHoldingGttForm(
    holding.trading_symbol,
  );
  const ltpColor = holding.last_price >= holding.close_price ? "text-pos" : "text-neg";
  const pnlColor = holding.pnl >= 0 ? "text-pos" : "text-neg";
  const cost = holding.quantity * holding.average_price;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-body font-semibold uppercase text-fg">
            {holding.trading_symbol}
          </span>
          <Badge>{holding.exchange}</Badge>
          <Badge variant={productBadgeVariant(holding.product)}>{holding.product}</Badge>
        </div>
        <div className="text-right">
          <div className={`font-mono text-body-sm ${ltpColor}`}>
            {formatPrice(holding.last_price)}
          </div>
          <div className={`text-caption ${pnlColor}`}>{formatPnl(holding.pnl, cost)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-caption text-fg-muted">
        <span>
          Qty <span className="font-mono text-fg-soft">{holding.quantity}</span>
        </span>
        <span>
          Avg <span className="font-mono text-fg-soft">{formatPrice(holding.average_price)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-wide text-fg-faint">SL threshold</span>
          <input
            type="text"
            inputMode="decimal"
            value={sl}
            placeholder="—"
            onChange={(event) => {
              setSl(event.target.value);
            }}
            disabled={isPending}
            className="h-9 rounded-md border border-neg-ring bg-neg-tint px-2 font-mono text-body-sm text-fg outline-none focus-visible:border-border-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-wide text-fg-faint">Target</span>
          <input
            type="text"
            inputMode="decimal"
            value={target}
            placeholder="—"
            onChange={(event) => {
              setTarget(event.target.value);
            }}
            disabled={isPending}
            className="h-9 rounded-md border border-pos-ring bg-pos-tint px-2 font-mono text-body-sm text-fg outline-none focus-visible:border-border-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      </div>

      {saveError !== null && <p className="text-caption text-neg">{saveError}</p>}

      <Button variant="secondary" onClick={handleSetGtt} disabled={isPending}>
        {isPending ? "Saving…" : "Set GTT"}
      </Button>
    </Card>
  );
}
