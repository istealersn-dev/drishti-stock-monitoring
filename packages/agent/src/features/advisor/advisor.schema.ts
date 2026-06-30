import { z } from "zod";

export const AdvisoryRequestSchema = z.object({
  question: z.string().min(1),
  sessionId: z.string(),
  channel: z.enum(["slack", "ui"]),
});
export type AdvisoryRequest = z.infer<typeof AdvisoryRequestSchema>;

export const AdvisoryResponseSchema = z.object({
  answer: z.string(),
  sessionId: z.string(),
});
export type AdvisoryResponse = z.infer<typeof AdvisoryResponseSchema>;

export const TradeSetupSchema = z.object({
  symbol: z.string(),
  entryLow: z.number(),
  entryHigh: z.number(),
  stopLoss: z.number(),
  targets: z.array(
    z.object({
      price: z.number(),
      isOpenEnded: z.boolean(),
    }),
  ),
  rationale: z.string(),
});
export type TradeSetup = z.infer<typeof TradeSetupSchema>;
