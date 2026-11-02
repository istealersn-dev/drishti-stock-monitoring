import type { GttOrder, Holding, HoldingConfig } from "./api";

const NEAR_SL_BAND = 1.05; // within 5% above the SL trigger counts as "near"

export type HoldingStatus = {
  variant: "pos" | "warn" | "neg" | "none";
  label: string;
};

/** Sort rank by SL status: breach, watch, no stop-loss to judge by, then safe. */
export const HOLDING_SEVERITY_RANK: Record<HoldingStatus["variant"], number> = {
  neg: 0,
  warn: 1,
  none: 2,
  pos: 3,
};

/**
 * Resolves a holding's SL proximity status against its stop-loss — a direct
 * port of Drishti.dc.html's `statusOf()` (same 5% band, same Safe/Watch/Breach
 * labels) onto real holding data.
 * @param holding - the holding to evaluate
 * @param slMap - trading symbol → stop-loss price, from {@link buildSlMap}
 * @returns the holding's status variant + label
 */
export function resolveHoldingStatus(holding: Holding, slMap: Map<string, number>): HoldingStatus {
  const sl = slMap.get(holding.trading_symbol);
  // A closed-out (zero-quantity) holding has no real exposure to alert on,
  // even if a stale SL/last_price pair would otherwise read as a breach.
  if (holding.quantity <= 0) {
    return { variant: "pos", label: "Safe" };
  }
  if (sl === undefined) {
    return { variant: "none", label: "No SL" };
  }
  if (holding.last_price <= sl) {
    return { variant: "neg", label: "Breach" };
  }
  if (holding.last_price <= sl * NEAR_SL_BAND) {
    return { variant: "warn", label: "Watch" };
  }
  return { variant: "pos", label: "Safe" };
}

/**
 * Builds a trading-symbol → stop-loss lookup. stock_config wins because it's
 * what the agent checks for a breach; it only places an sl_exit GTT afterwards,
 * so an active GTT just covers a holding whose config has gone.
 * @param gttOrders - the active GTT orders to index
 * @param holdingConfigs - the active stock_config rows
 * @returns map of trading symbol to its stop-loss price
 */
export function buildSlMap(
  gttOrders: GttOrder[],
  holdingConfigs: HoldingConfig[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of gttOrders) {
    // packages/agent only ever writes "sl_exit" (stopLoss.handler.ts,
    // agent.graph.ts) or "buy_entry" (instructions.executor.ts) — never the
    // literal "SL" this used to check, which meant this map was always empty.
    // A zero trigger is malformed, not protection, so it reads as no stop-loss.
    if (order.type === "sl_exit" && order.triggerPrice > 0 && !map.has(order.symbol)) {
      map.set(order.symbol, order.triggerPrice);
    }
  }
  for (const config of holdingConfigs) {
    map.set(config.symbol, config.slThreshold);
  }
  return map;
}

/**
 * Builds a trading-symbol → first-target lookup.
 * @param holdingConfigs - the active stock_config rows
 * @returns map of trading symbol to its first target, where one is set
 */
export function buildTargetMap(holdingConfigs: HoldingConfig[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const { symbol, targetOne } of holdingConfigs) {
    if (targetOne !== null) map.set(symbol, targetOne);
  }
  return map;
}
