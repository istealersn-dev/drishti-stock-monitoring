import type { Holding } from "./api";
import { distanceToSlPercentage, pnlPercentage } from "./holdingFormat";
import { HOLDING_SEVERITY_RANK, type HoldingStatus, resolveHoldingStatus } from "./holdingStatus";

export type SortDirection = "none" | "desc" | "asc";

const DEFAULT_ROW_LIMIT = 5;

export type RankedPosition = {
  holding: Holding;
  status: HoldingStatus;
  sl: number | undefined;
  pnlPct: number;
  distanceToSl: number | undefined;
};

type PositionRanking = {
  rows: RankedPosition[];
  atRiskCount: number;
  noSlCount: number;
};

/**
 * Orders holdings for the dashboard snapshot. Severity always wins, with the
 * P&L sort or distance to SL inside it, and every at-risk row, plus every row
 * with no stop-loss to judge by, shows regardless of the row limit: this is desktop's
 * only list of them.
 * @param holdings - current holdings
 * @param slMap - symbol -> stop-loss price
 * @param sortDirection - the P&L % sort
 * @returns the rows to show, with at-risk and no-SL counts
 */
export function rankPositions(
  holdings: Holding[],
  slMap: Map<string, number>,
  sortDirection: SortDirection,
): PositionRanking {
  const positions = holdings.map((holding) => {
    const sl = slMap.get(holding.trading_symbol);
    return {
      holding,
      status: resolveHoldingStatus(holding, slMap),
      sl,
      pnlPct: pnlPercentage(holding),
      distanceToSl: distanceToSlPercentage(holding, sl),
    };
  });
  const atRiskCount = positions.filter(
    ({ status }) => status.variant === "neg" || status.variant === "warn",
  ).length;
  const noSlCount = positions.filter(({ status }) => status.variant === "none").length;

  const sorted = [...positions].sort((a, b) => {
    const bySeverity =
      HOLDING_SEVERITY_RANK[a.status.variant] - HOLDING_SEVERITY_RANK[b.status.variant];
    if (bySeverity !== 0) return bySeverity;
    if (sortDirection === "none") return (a.distanceToSl ?? 0) - (b.distanceToSl ?? 0);
    return sortDirection === "desc" ? b.pnlPct - a.pnlPct : a.pnlPct - b.pnlPct;
  });

  return {
    rows: sorted.slice(0, Math.max(DEFAULT_ROW_LIMIT, atRiskCount + noSlCount)),
    atRiskCount,
    noSlCount,
  };
}
