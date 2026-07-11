import type { TriggerOrderRequest } from "../../broker/brokerClient.types.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

const LIMIT_PRICE_BUFFER = 0.99;

/**
 * Build a broker-agnostic stop-loss exit request for a holding.
 * Sets the limit price 1% below the trigger to absorb gap-down risk.
 * @param holding - The portfolio holding to exit (still Upstox-shaped —
 *   agent.graph.ts's state.holdings hasn't been migrated to the broker-agnostic
 *   type yet; that's a separate PR since it cascades through several detectors)
 * @param slThreshold - The stop-loss trigger price
 * @returns A TriggerOrderRequest ready to send through BrokerClient
 */
export function buildSlExitRequest(holding: Holding, slThreshold: number): TriggerOrderRequest {
  const limitPrice = Number((slThreshold * LIMIT_PRICE_BUFFER).toFixed(2));
  return {
    transactionType: "SELL",
    tradingSymbol: holding.trading_symbol,
    exchange: holding.exchange,
    instrumentToken: holding.instrument_token,
    product: holding.product,
    quantity: holding.quantity,
    triggerPrice: slThreshold,
    limitPrice,
  };
}
