import type { GttOrder } from "../../features/gtt/gtt.schema.js";
import {
  cancelGTT as upstoxCancelGTT,
  createGTT as upstoxCreateGTT,
  listGTTs as upstoxListGTTs,
} from "../../features/gtt/gtt.tools.js";
import { resolveSymbol } from "../../features/instructions/instructions.resolver.js";
import type { Holding as UpstoxHolding } from "../../features/portfolio/portfolio.schema.js";
import {
  fetchHoldings as upstoxFetchHoldings,
  fetchLTP as upstoxFetchLTP,
  fetchMargins as upstoxFetchMargins,
} from "../../features/portfolio/portfolio.tools.js";
import type { OHLCVBar } from "../../features/technicals/technicals.schema.js";
import { fetchOHLCV as upstoxFetchOHLCV } from "../../features/technicals/technicals.service.js";
import type { BrokerError, Result } from "../../shared/errors.js";
import { ok } from "../../shared/errors.js";
import type {
  BrokerClient,
  Candle,
  Holding,
  InstrumentMatch,
  Margin,
  Quote,
  TriggerOrder,
  TriggerOrderRequest,
} from "../brokerClient.types.js";

function toHolding(holding: UpstoxHolding): Holding {
  return {
    isin: holding.isin,
    tradingSymbol: holding.trading_symbol,
    companyName: holding.company_name,
    quantity: holding.quantity,
    averagePrice: holding.average_price,
    lastPrice: holding.last_price,
    closePrice: holding.close_price,
    pnl: holding.pnl,
    dayChange: holding.day_change,
    dayChangePercentage: holding.day_change_percentage,
    instrumentToken: holding.instrument_token,
    exchange: holding.exchange,
    product: holding.product,
    t1Quantity: holding.t1_quantity,
    collateralQuantity: holding.collateral_quantity,
  };
}

function toTriggerOrder(order: GttOrder): TriggerOrder {
  return {
    orderId: order.order_id,
    tradingSymbol: order.trading_symbol,
    exchange: order.exchange,
    instrumentToken: order.instrument_token,
    transactionType: order.transaction_type,
    quantity: order.quantity,
    product: order.product,
    triggerPrice: order.trigger_price,
    limitPrice: order.limit_price,
    status: order.status,
  };
}

function toCandle(bar: OHLCVBar): Candle {
  return {
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    oi: bar.oi,
  };
}

/**
 * Build a BrokerClient backed by the existing Upstox tool functions
 * (portfolio.tools.ts, gtt.tools.ts, technicals.service.ts, instructions.resolver.ts).
 * Wraps those functions rather than reimplementing them, so this adapter carries
 * no new network/auth logic — it only translates Upstox's wire shapes into the
 * broker-agnostic DTOs the rest of the app depends on.
 * @returns A BrokerClient for the Upstox account configured via env
 */
export function createUpstoxClient(): BrokerClient {
  return {
    id: "upstox",

    async fetchHoldings(): Promise<Result<Holding[], BrokerError>> {
      const result = await upstoxFetchHoldings();
      if (!result.ok) return result;
      return ok(result.value.map(toHolding));
    },

    async fetchQuotes(
      instrumentKeys: string[],
    ): Promise<Result<Record<string, Quote>, BrokerError>> {
      if (instrumentKeys.length === 0) return ok({});
      const result = await upstoxFetchLTP(instrumentKeys.join(","));
      if (!result.ok) return result;
      const quotes: Record<string, Quote> = {};
      for (const [key, data] of Object.entries(result.value)) {
        quotes[key] = { instrumentToken: data.instrument_token, lastPrice: data.last_price };
      }
      return ok(quotes);
    },

    async fetchMargins(): Promise<Result<Margin, BrokerError>> {
      const result = await upstoxFetchMargins();
      if (!result.ok) return result;
      return ok({
        availableMargin: result.value.available_margin,
        usedMargin: result.value.used_margin,
      });
    },

    async createTriggerOrder(
      request: TriggerOrderRequest,
      dryRun: boolean,
    ): Promise<Result<string, BrokerError>> {
      return upstoxCreateGTT(
        {
          transaction_type: request.transactionType,
          trading_symbol: request.tradingSymbol,
          exchange: request.exchange,
          instrument_token: request.instrumentToken,
          product: request.product,
          quantity: request.quantity,
          order_type: "LIMIT",
          trigger_price: request.triggerPrice,
          limit_price: request.limitPrice,
        },
        dryRun,
      );
    },

    async listTriggerOrders(): Promise<Result<TriggerOrder[], BrokerError>> {
      const result = await upstoxListGTTs();
      if (!result.ok) return result;
      return ok(result.value.map(toTriggerOrder));
    },

    async cancelTriggerOrder(
      orderId: string,
      dryRun: boolean,
    ): Promise<Result<string, BrokerError>> {
      return upstoxCancelGTT(orderId, dryRun);
    },

    async searchInstrument(query: string): Promise<Result<InstrumentMatch, BrokerError>> {
      const result = await resolveSymbol(query);
      if (!result.ok) return result;
      return ok({
        tradingSymbol: result.value.tradingSymbol,
        exchange: result.value.exchange,
        instrumentToken: result.value.instrumentToken,
      });
    },

    async fetchOHLCV(instrumentKey: string, days: number): Promise<Result<Candle[], BrokerError>> {
      const result = await upstoxFetchOHLCV(instrumentKey, days);
      if (!result.ok) return result;
      return ok(result.value.map(toCandle));
    },
  };
}
