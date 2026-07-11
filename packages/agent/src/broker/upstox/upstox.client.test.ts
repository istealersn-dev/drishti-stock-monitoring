import { describe, it, expect, vi } from "vitest";

const {
  mockFetchHoldings,
  mockFetchLTP,
  mockFetchMargins,
  mockCreateGTT,
  mockListGTTs,
  mockCancelGTT,
  mockFetchOHLCV,
  mockResolveSymbol,
} = vi.hoisted(() => ({
  mockFetchHoldings: vi.fn(),
  mockFetchLTP: vi.fn(),
  mockFetchMargins: vi.fn(),
  mockCreateGTT: vi.fn(),
  mockListGTTs: vi.fn(),
  mockCancelGTT: vi.fn(),
  mockFetchOHLCV: vi.fn(),
  mockResolveSymbol: vi.fn(),
}));

vi.mock("../../features/portfolio/portfolio.tools.js", () => ({
  fetchHoldings: mockFetchHoldings,
  fetchLTP: mockFetchLTP,
  fetchMargins: mockFetchMargins,
}));
vi.mock("../../features/gtt/gtt.tools.js", () => ({
  createGTT: mockCreateGTT,
  listGTTs: mockListGTTs,
  cancelGTT: mockCancelGTT,
}));
vi.mock("../../features/technicals/technicals.service.js", () => ({
  fetchOHLCV: mockFetchOHLCV,
}));
vi.mock("../../features/instructions/instructions.resolver.js", () => ({
  resolveSymbol: mockResolveSymbol,
}));

import { UpstoxError, ok, err } from "../../shared/errors.js";

import { createUpstoxClient } from "./upstox.client.js";

const client = createUpstoxClient();

describe("createUpstoxClient", () => {
  it("has id 'upstox'", () => {
    expect(client.id).toBe("upstox");
  });

  describe("fetchHoldings", () => {
    it("translates Upstox holdings to the broker-agnostic shape", async () => {
      mockFetchHoldings.mockResolvedValue(
        ok([
          {
            isin: "INE002A01018",
            trading_symbol: "RELIANCE",
            company_name: "Reliance Industries Ltd",
            quantity: 10,
            average_price: 2800,
            last_price: 2900,
            close_price: 2880,
            pnl: 1000,
            day_change: 20,
            day_change_percentage: 0.69,
            instrument_token: "NSE_EQ|INE002A01018",
            exchange: "NSE",
            product: "CNC",
            t1_quantity: 5,
            collateral_quantity: 2,
          },
        ]),
      );

      const result = await client.fetchHoldings();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([
          {
            isin: "INE002A01018",
            tradingSymbol: "RELIANCE",
            companyName: "Reliance Industries Ltd",
            quantity: 10,
            averagePrice: 2800,
            lastPrice: 2900,
            closePrice: 2880,
            pnl: 1000,
            dayChange: 20,
            dayChangePercentage: 0.69,
            instrumentToken: "NSE_EQ|INE002A01018",
            exchange: "NSE",
            product: "CNC",
            t1Quantity: 5,
            collateralQuantity: 2,
          },
        ]);
      }
    });

    it("passes through the underlying error unchanged", async () => {
      const error = new UpstoxError("boom", 500);
      mockFetchHoldings.mockResolvedValue(err(error));

      const result = await client.fetchHoldings();

      expect(result).toEqual(err(error));
    });
  });

  describe("fetchQuotes", () => {
    it("joins instrument keys and translates the response map", async () => {
      mockFetchLTP.mockResolvedValue(
        ok({
          "NSE_EQ|INE002A01018": { last_price: 2900, instrument_token: "NSE_EQ|INE002A01018" },
        }),
      );

      const result = await client.fetchQuotes(["NSE_EQ|INE002A01018", "NSE_EQ|INE009A01021"]);

      expect(mockFetchLTP).toHaveBeenCalledWith("NSE_EQ|INE002A01018,NSE_EQ|INE009A01021");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          "NSE_EQ|INE002A01018": { instrumentToken: "NSE_EQ|INE002A01018", lastPrice: 2900 },
        });
      }
    });
  });

  describe("fetchMargins", () => {
    it("translates margin field names", async () => {
      mockFetchMargins.mockResolvedValue(ok({ available_margin: 50000, used_margin: 10000 }));

      const result = await client.fetchMargins();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ availableMargin: 50000, usedMargin: 10000 });
      }
    });
  });

  describe("createTriggerOrder", () => {
    it("translates the request and forwards dryRun", async () => {
      mockCreateGTT.mockResolvedValue(ok("order-123"));

      const result = await client.createTriggerOrder(
        {
          transactionType: "SELL",
          tradingSymbol: "RELIANCE",
          exchange: "NSE",
          instrumentToken: "NSE_EQ|INE002A01018",
          product: "CNC",
          quantity: 10,
          triggerPrice: 2500,
          limitPrice: 2475,
        },
        true,
      );

      expect(mockCreateGTT).toHaveBeenCalledWith(
        {
          transaction_type: "SELL",
          trading_symbol: "RELIANCE",
          exchange: "NSE",
          instrument_token: "NSE_EQ|INE002A01018",
          product: "CNC",
          quantity: 10,
          order_type: "LIMIT",
          trigger_price: 2500,
          limit_price: 2475,
        },
        true,
      );
      expect(result).toEqual(ok("order-123"));
    });
  });

  describe("listTriggerOrders", () => {
    it("translates each GTT order", async () => {
      mockListGTTs.mockResolvedValue(
        ok([
          {
            order_id: "order-123",
            trading_symbol: "RELIANCE",
            exchange: "NSE",
            instrument_token: "NSE_EQ|INE002A01018",
            transaction_type: "SELL",
            quantity: 10,
            product: "CNC",
            order_type: "LIMIT",
            trigger_price: 2500,
            limit_price: 2475,
            status: "active",
          },
        ]),
      );

      const result = await client.listTriggerOrders();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([
          {
            orderId: "order-123",
            tradingSymbol: "RELIANCE",
            exchange: "NSE",
            instrumentToken: "NSE_EQ|INE002A01018",
            transactionType: "SELL",
            quantity: 10,
            product: "CNC",
            triggerPrice: 2500,
            limitPrice: 2475,
            status: "active",
          },
        ]);
      }
    });
  });

  describe("cancelTriggerOrder", () => {
    it("delegates to cancelGTT with orderId and dryRun", async () => {
      mockCancelGTT.mockResolvedValue(ok("order-123"));

      const result = await client.cancelTriggerOrder("order-123", false);

      expect(mockCancelGTT).toHaveBeenCalledWith("order-123", false);
      expect(result).toEqual(ok("order-123"));
    });
  });

  describe("searchInstrument", () => {
    it("translates the resolved stock", async () => {
      mockResolveSymbol.mockResolvedValue(
        ok({
          tradingSymbol: "RELIANCE",
          exchange: "NSE",
          instrumentToken: "NSE_EQ|INE002A01018",
        }),
      );

      const result = await client.searchInstrument("Reliance");

      expect(mockResolveSymbol).toHaveBeenCalledWith("Reliance");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          tradingSymbol: "RELIANCE",
          exchange: "NSE",
          instrumentToken: "NSE_EQ|INE002A01018",
        });
      }
    });
  });

  describe("fetchOHLCV", () => {
    it("translates OHLCV bars to candles", async () => {
      mockFetchOHLCV.mockResolvedValue(
        ok([
          {
            timestamp: "2026-07-01",
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 1000,
            oi: 50,
          },
        ]),
      );

      const result = await client.fetchOHLCV("NSE_EQ|INE002A01018", 30);

      expect(mockFetchOHLCV).toHaveBeenCalledWith("NSE_EQ|INE002A01018", 30);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([
          {
            timestamp: "2026-07-01",
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 1000,
            oi: 50,
          },
        ]);
      }
    });
  });
});
