import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../shared/env.js", () => ({
  env: {
    UPSTOX_ACCESS_TOKEN: "test-access-token",
  },
}));

import type { Holding } from "../portfolio/portfolio.schema.js";

import type { GttCreateRequest } from "./gtt.schema.js";
import { buildSlExitRequest } from "./gtt.service.js";
import { createGTT, cancelGTT } from "./gtt.tools.js";

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  isin: "INE238A01034",
  trading_symbol: "AXISBANK-EQ",
  company_name: "Axis Bank Ltd",
  quantity: 50,
  average_price: 1000,
  last_price: 950,
  close_price: 960,
  pnl: -2500,
  day_change: -10,
  day_change_percentage: -1.04,
  instrument_token: "NSE_EQ|INE238A01034",
  exchange: "NSE",
  product: "D",
  ...overrides,
});

describe("buildSlExitRequest", () => {
  it("builds a SELL LIMIT GTT at the SL threshold", () => {
    const holding = makeHolding();
    const request = buildSlExitRequest(holding, 900);

    expect(request.transactionType).toBe("SELL");
    expect(request.triggerPrice).toBe(900);
    expect(request.tradingSymbol).toBe("AXISBANK-EQ");
    expect(request.exchange).toBe("NSE");
    expect(request.quantity).toBe(50);
    expect(request.product).toBe("D");
    expect(request.instrumentToken).toBe("NSE_EQ|INE238A01034");
  });

  it("sets limit price 1% below trigger", () => {
    const request = buildSlExitRequest(makeHolding(), 1000);
    expect(request.limitPrice).toBe(990);
  });

  it("rounds limit price to 2 decimal places", () => {
    const request = buildSlExitRequest(makeHolding(), 333);
    expect(request.limitPrice).toBe(Number((333 * 0.99).toFixed(2)));
  });
});

describe("createGTT (dry run)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns ok with dry-run message without calling fetch", async () => {
    const request: GttCreateRequest = {
      transaction_type: "SELL",
      trading_symbol: "AXISBANK-EQ",
      exchange: "NSE",
      instrument_token: "NSE_EQ|INE238A01034",
      product: "D",
      quantity: 50,
      order_type: "LIMIT",
      trigger_price: 900,
      limit_price: 891,
    };
    const result = await createGTT(request, true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("[DRY_RUN]");
      expect(result.value).toContain("AXISBANK-EQ");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("cancelGTT (dry run)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns ok with dry-run message without calling fetch", async () => {
    const result = await cancelGTT("order-123", true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("[DRY_RUN]");
      expect(result.value).toContain("order-123");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
