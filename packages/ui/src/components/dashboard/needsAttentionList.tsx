import type React from "react";

import type { Holding } from "../../lib/api";
import { distanceToSlPercentage, pnlPercentage } from "../../lib/holdingFormat";
import { HOLDING_SEVERITY_RANK, resolveHoldingStatus } from "../../lib/holdingStatus";
import { Badge } from "../ui/badge";
import { StatusDot } from "../ui/statusDot";

import { NeedsAttentionCard } from "./needsAttentionCard";

type NeedsAttentionListProperties = {
  holdings: Holding[];
  slMap: Map<string, number>;
};

/**
 * Mobile dashboard's at-risk list: holdings at or within 5% of their
 * stop-loss, breach-first. Desktop's positions snapshot covers the same
 * holdings.
 * @param props.holdings - Current holdings
 * @param props.slMap - Symbol -> stop-loss threshold
 * @returns Needs attention section
 */
export function NeedsAttentionList({
  holdings,
  slMap,
}: NeedsAttentionListProperties): React.ReactElement {
  // flatMap so `sl` and its distance are proven defined for each survivor.
  const atRisk = holdings
    .flatMap((holding) => {
      const sl = slMap.get(holding.trading_symbol);
      const distanceToSl = distanceToSlPercentage(holding, sl);
      if (sl === undefined || distanceToSl === undefined) return [];
      const status = resolveHoldingStatus(holding, slMap);
      if (status.variant !== "neg" && status.variant !== "warn") return [];
      return [{ holding, sl, distanceToSl, status }];
    })
    .sort(
      (a, b) =>
        HOLDING_SEVERITY_RANK[a.status.variant] - HOLDING_SEVERITY_RANK[b.status.variant] ||
        a.distanceToSl - b.distanceToSl,
    );
  const noStopLossCount = holdings.filter((holding) => !slMap.has(holding.trading_symbol)).length;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-title font-semibold text-fg">Needs attention</h2>
        <Badge variant="neutral">{atRisk.length}</Badge>
      </div>
      {holdings.length === 0 ? (
        <div className="rounded-xl border border-border-strong bg-surface-2 p-4">
          <p className="text-body-sm font-medium text-fg-muted">No positions</p>
          <p className="text-caption text-fg-faint">Holdings appear once data is synced.</p>
        </div>
      ) : atRisk.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface-2 p-4">
          <StatusDot
            variant={noStopLossCount > 0 ? "warn" : "pos"}
            label={noStopLossCount > 0 ? "None near a stop-loss" : "All positions safe"}
            pulse={false}
          />
          <div>
            <p className="text-body-sm font-medium text-fg">
              {noStopLossCount > 0 ? "None near a stop-loss" : "All positions safe"}
            </p>
            <p className="text-caption text-fg-muted">No holdings near their stop-loss.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {atRisk.map(({ holding, sl, distanceToSl, status }) => (
            <NeedsAttentionCard
              key={`${holding.isin}-${holding.product}`}
              symbol={holding.trading_symbol}
              statusLabel={status.label}
              variant={status.variant === "neg" ? "danger" : "warning"}
              ltp={holding.last_price}
              pnlPercentage={pnlPercentage(holding)}
              sl={sl}
              distanceToSlPercentage={distanceToSl}
            />
          ))}
        </div>
      )}
      {noStopLossCount > 0 && (
        <p className="text-caption text-warn">
          {noStopLossCount} of {holdings.length} have no active stop-loss GTT.
        </p>
      )}
    </section>
  );
}
