import { useNavigate } from "@tanstack/react-router";
import type React from "react";

import { formatPrice } from "../../lib/holdingFormat";
import { Button } from "../ui/button";
import { StatusDot } from "../ui/statusDot";

type AttentionVariant = "danger" | "warning";

const STATUS_DOT_VARIANT: Record<AttentionVariant, "neg" | "warn"> = {
  danger: "neg",
  warning: "warn",
};

const BORDER_CLASS: Record<AttentionVariant, string> = {
  danger: "border-l-neg",
  warning: "border-l-warn",
};

type NeedsAttentionCardProperties = {
  symbol: string;
  statusLabel: string;
  variant: AttentionVariant;
  ltp: number;
  pnlPercentage: number;
  sl: number;
  distanceToSlPercentage: number;
};

/**
 * Dashboard "Needs attention" card (Drishti.dc.html) — one row per holding
 * whose LTP has breached or is within 5% of its GTT stop-loss. "Set GTT"
 * routes to Holdings, where the actual SL/target editing form lives — this
 * card is a triage surface, not a duplicate editing form. (The prototype's
 * per-row "Pause/Resume" action has no backing endpoint — the app only has a
 * single agent-wide `pauseAgent` setting — so it's intentionally omitted
 * here rather than wired to nothing.)
 * @param props.symbol - trading symbol
 * @param props.statusLabel - "Breach" or "Watch"
 * @param props.variant - severity, drives the left border/status dot color
 * @param props.ltp - last traded price
 * @param props.pnlPercentage - unrealised P&L percent
 * @param props.sl - the GTT stop-loss trigger price
 * @param props.distanceToSlPercentage - how far LTP is above the SL, as a percent
 * @returns Needs-attention card element
 */
export function NeedsAttentionCard({
  symbol,
  statusLabel,
  variant,
  ltp,
  pnlPercentage,
  sl,
  distanceToSlPercentage,
}: NeedsAttentionCardProperties): React.ReactElement {
  const navigate = useNavigate();

  return (
    <article
      className={`flex flex-col gap-2 rounded-xl border-l-2 bg-surface-2 p-3 ${BORDER_CLASS[variant]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-body-sm font-semibold uppercase text-fg">{symbol}</span>
          <StatusDot variant={STATUS_DOT_VARIANT[variant]} label={statusLabel} />
          <span className="text-micro font-semibold uppercase tracking-wide text-fg-muted">
            {statusLabel}
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-body-sm text-fg">₹{formatPrice(ltp)}</div>
          <div className={`text-caption ${pnlPercentage >= 0 ? "text-pos" : "text-neg"}`}>
            {pnlPercentage >= 0 ? "+" : ""}
            {pnlPercentage.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-caption text-fg-muted">
        <span>
          SL <span className="font-mono text-fg-soft">₹{formatPrice(sl)}</span>
        </span>
        <span>
          LTP→SL{" "}
          <span className="font-mono text-fg-soft">{distanceToSlPercentage.toFixed(1)}%</span>
        </span>
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          void navigate({ to: "/holdings" });
        }}
      >
        Set GTT
      </Button>
    </article>
  );
}
