import type { Holding, TriggerOrderRequest } from "../../broker/brokerClient.types.js";

const LIMIT_PRICE_BUFFER = 0.99;

/**
 * Build a broker-agnostic stop-loss exit request for a holding.
 * Sets the limit price 1% below the trigger to absorb gap-down risk.
 * @param holding - The portfolio holding to exit
 * @param slThreshold - The stop-loss trigger price
 * @returns A TriggerOrderRequest ready to send through BrokerClient
 */
export function buildSlExitRequest(holding: Holding, slThreshold: number): TriggerOrderRequest {
  const limitPrice = Number((slThreshold * LIMIT_PRICE_BUFFER).toFixed(2));
  return {
    transactionType: "SELL",
    tradingSymbol: holding.tradingSymbol,
    exchange: holding.exchange,
    instrumentToken: holding.instrumentToken,
    product: holding.product,
    quantity: holding.quantity,
    triggerPrice: slThreshold,
    limitPrice,
  };
}
