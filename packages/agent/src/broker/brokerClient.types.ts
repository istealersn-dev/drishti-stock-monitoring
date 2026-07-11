import { z } from "zod";

import type { BrokerError, Result } from "../shared/errors.js";

export const BROKER_IDS = ["upstox", "groww"] as const;
export const BrokerIdSchema = z.enum(BROKER_IDS);
export type BrokerId = z.infer<typeof BrokerIdSchema>;

export const HoldingSchema = z.object({
  isin: z.string(),
  tradingSymbol: z.string(),
  companyName: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  lastPrice: z.number(),
  closePrice: z.number(),
  pnl: z.number(),
  dayChange: z.number(),
  dayChangePercentage: z.number(),
  instrumentToken: z.string(),
  exchange: z.string(),
  product: z.string(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const QuoteSchema = z.object({
  instrumentToken: z.string(),
  lastPrice: z.number(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const MarginSchema = z.object({
  availableMargin: z.number(),
  usedMargin: z.number().optional(),
});
export type Margin = z.infer<typeof MarginSchema>;

export const TriggerOrderRequestSchema = z.object({
  transactionType: z.enum(["BUY", "SELL"]),
  tradingSymbol: z.string().min(1),
  exchange: z.string().min(1),
  instrumentToken: z.string().min(1),
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  triggerPrice: z.number().positive(),
  limitPrice: z.number().positive(),
});
export type TriggerOrderRequest = z.infer<typeof TriggerOrderRequestSchema>;

export const TriggerOrderSchema = z.object({
  orderId: z.string(),
  tradingSymbol: z.string(),
  exchange: z.string(),
  instrumentToken: z.string(),
  transactionType: z.string(),
  quantity: z.number(),
  product: z.string(),
  triggerPrice: z.number(),
  limitPrice: z.number(),
  status: z.string(),
});
export type TriggerOrder = z.infer<typeof TriggerOrderSchema>;

export const CandleSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});
export type Candle = z.infer<typeof CandleSchema>;

export const InstrumentMatchSchema = z.object({
  tradingSymbol: z.string(),
  exchange: z.string(),
  instrumentToken: z.string(),
});
export type InstrumentMatch = z.infer<typeof InstrumentMatchSchema>;

/**
 * Broker-agnostic contract every broker adapter (Upstox, Groww, ...) implements.
 * Callers depend on this interface, never on a specific broker's client, so a
 * second broker plugs in without touching agent logic, prompts, or the UI.
 */
export interface BrokerClient {
  id: BrokerId;
  fetchHoldings(): Promise<Result<Holding[], BrokerError>>;
  fetchQuotes(instrumentKeys: string[]): Promise<Result<Record<string, Quote>, BrokerError>>;
  fetchMargins(): Promise<Result<Margin, BrokerError>>;
  createTriggerOrder(
    request: TriggerOrderRequest,
    dryRun: boolean,
  ): Promise<Result<string, BrokerError>>;
  listTriggerOrders(): Promise<Result<TriggerOrder[], BrokerError>>;
  cancelTriggerOrder(orderId: string, dryRun: boolean): Promise<Result<string, BrokerError>>;
  searchInstrument(query: string): Promise<Result<InstrumentMatch, BrokerError>>;
  fetchOHLCV(instrumentKey: string, days: number): Promise<Result<Candle[], BrokerError>>;
}
