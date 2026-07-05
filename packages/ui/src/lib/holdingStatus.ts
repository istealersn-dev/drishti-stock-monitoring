import type { GttOrder, Holding } from "./api";

const NEAR_SL_BAND = 1.05; // within 5% above the SL trigger counts as "near"

export type HoldingStatus = {
  variant: "pos" | "warn" | "neg";
  label: string;
};

/**
 * Resolves a holding's SL proximity status against its GTT stop-loss trigger
 * — a direct port of Drishti.dc.html's `statusOf()` (same 5% band, same
 * Safe/Watch/Breach labels) onto real GTT/holding data.
 * @param holding - the holding to evaluate
 * @param slMap - trading symbol → active SL trigger price, from {@link buildSlMap}
 * @returns the holding's status variant + label
 */
export function resolveHoldingStatus(holding: Holding, slMap: Map<string, number>): HoldingStatus {
  const sl = slMap.get(holding.trading_symbol);
  // A closed-out (zero-quantity) holding has no real exposure to alert on,
  // even if a stale SL/last_price pair would otherwise read as a breach.
  if (holding.quantity <= 0) {
    return { variant: "pos", label: "Safe" };
  }
  if (sl !== undefined && holding.last_price <= sl) {
    return { variant: "neg", label: "Breach" };
  }
  if (sl !== undefined && holding.last_price <= sl * NEAR_SL_BAND) {
    return { variant: "warn", label: "Watch" };
  }
  return { variant: "pos", label: "Safe" };
}

/**
 * Builds a trading-symbol → SL-trigger-price lookup from active GTT orders.
 * @param gttOrders - the active GTT orders to index
 * @returns map of trading symbol to its SL trigger price
 */
export function buildSlMap(gttOrders: GttOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of gttOrders) {
    if (order.type === "SL" && !map.has(order.symbol)) {
      map.set(order.symbol, order.triggerPrice);
    }
  }
  return map;
}
