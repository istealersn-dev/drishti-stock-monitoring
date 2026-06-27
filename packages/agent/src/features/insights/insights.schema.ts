import { z } from "zod";

export const LlmActionSchema = z.enum(["hold", "gtt_modify", "gtt_cancel", "alert_only"]);

export type LlmAction = z.infer<typeof LlmActionSchema>;

export const GttModifyParametersSchema = z.object({
  newTriggerPrice: z.number().positive(),
  newLimitPrice: z.number().positive(),
});

export type GttModifyParameters = z.infer<typeof GttModifyParametersSchema>;

export const LlmDecisionSchema = z.object({
  symbol: z.string().min(1),
  action: LlmActionSchema,
  reasoning: z.string().min(1),
  gttParams: GttModifyParametersSchema.nullable(),
});

export type LlmDecision = z.infer<typeof LlmDecisionSchema>;

export const LlmOutputSchema = z.object({
  decisions: z.array(LlmDecisionSchema),
  portfolioSummary: z.string().min(1),
});

export type LlmOutput = z.infer<typeof LlmOutputSchema>;
