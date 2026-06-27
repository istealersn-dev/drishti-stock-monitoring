import type { Holding } from "../portfolio/portfolio.schema.js";

import type { GttCreateRequest } from "./gtt.schema.js";

const LIMIT_PRICE_BUFFER = 0.99;

/**
 * Build a GTT stop-loss exit request for a holding.
 * Sets the limit price 1% below the trigger to absorb gap-down risk.
 * @param holding - The portfolio holding to exit
 * @param slThreshold - The stop-loss trigger price
 * @returns A GttCreateRequest ready to send to Upstox
 */
export function buildSlExitRequest(holding: Holding, slThreshold: number): GttCreateRequest {
  const limitPrice = Number((slThreshold * LIMIT_PRICE_BUFFER).toFixed(2));
  return {
    transaction_type: "SELL",
    trading_symbol: holding.trading_symbol,
    exchange: holding.exchange,
    instrument_token: holding.instrument_token,
    product: holding.product,
    quantity: holding.quantity,
    order_type: "LIMIT",
    trigger_price: slThreshold,
    limit_price: limitPrice,
  };
}
