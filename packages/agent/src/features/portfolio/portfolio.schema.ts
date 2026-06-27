import { z } from "zod";

export const HoldingSchema = z.object({
  isin: z.string(),
  trading_symbol: z.string(),
  company_name: z.string(),
  quantity: z.number(),
  average_price: z.number(),
  last_price: z.number(),
  close_price: z.number(),
  pnl: z.number(),
  day_change: z.number(),
  day_change_percentage: z.number(),
  instrument_token: z.string(),
  exchange: z.string(),
  product: z.string(),
  t1_quantity: z.number().optional(),
  collateral_quantity: z.number().optional(),
});

export type Holding = z.infer<typeof HoldingSchema>;

export const HoldingsResponseSchema = z.object({
  status: z.string(),
  data: z.array(HoldingSchema),
});

export const LtpDataSchema = z.object({
  last_price: z.number(),
  instrument_token: z.string(),
});

export const LtpResponseSchema = z.object({
  status: z.string(),
  data: z.record(LtpDataSchema),
});

export type LtpData = z.infer<typeof LtpDataSchema>;

export const MarginEquitySchema = z.object({
  available_margin: z.number(),
  used_margin: z.number().optional(),
  payin_amount: z.number().optional(),
});

export const MarginResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    equity: MarginEquitySchema.optional(),
  }),
});

export type MarginEquity = z.infer<typeof MarginEquitySchema>;
