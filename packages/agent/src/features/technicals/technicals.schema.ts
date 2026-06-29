import { z } from "zod";

export const OHLCVBarSchema = z.object({
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  oi: z.number().optional(),
});
export type OHLCVBar = z.infer<typeof OHLCVBarSchema>;

export const HistoricalCandleResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    candles: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
});

export const TechnicalLevelsSchema = z.object({
  symbol: z.string(),
  date: z.string(),
  dma50: z.number().nullable(),
  dma200: z.number().nullable(),
  weekHigh52: z.number().nullable(),
  weekLow52: z.number().nullable(),
  swingHigh: z.number().nullable(),
  swingLow: z.number().nullable(),
  avgVolume20: z.number().nullable(),
  updatedAt: z.string(),
});
export type TechnicalLevels = z.infer<typeof TechnicalLevelsSchema>;
