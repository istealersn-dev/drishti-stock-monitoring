import { z } from "zod";

export const TargetSchema = z.object({
  price: z.number().positive(),
  isOpenEnded: z.boolean(),
});

export type Target = z.infer<typeof TargetSchema>;

export const ParsedInstructionSchema = z.object({
  stockName: z.string().min(1),
  action: z.literal("BUY"),
  entryLow: z.number().positive().nullable(),
  entryHigh: z.number().positive().nullable(),
  stopLoss: z.number().positive().nullable(),
  targets: z.array(TargetSchema),
});

export type ParsedInstruction = z.infer<typeof ParsedInstructionSchema>;

export const ResolvedStockSchema = z.object({
  tradingSymbol: z.string(),
  exchange: z.string(),
  instrumentToken: z.string(),
});

export type ResolvedStock = z.infer<typeof ResolvedStockSchema>;

export const IntentClassificationSchema = z.object({
  intent: z.enum(["ORDER", "QUERY", "AMBIGUOUS"]),
  clarifyingQuestion: z.string().nullable(),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;
