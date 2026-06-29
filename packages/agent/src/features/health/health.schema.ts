import { z } from "zod";

export const UnderperformerSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  buyPrice: z.number(),
  currentLtp: z.number(),
  pctDown: z.number(),
});

export const PortfolioHealthReportSchema = z.object({
  generatedAt: z.string(),
  totalPortfolioValue: z.number(),
  totalCapitalAtRisk: z.number(),
  capitalAtRiskPct: z.number(),
  mtfBurnRateMonthly: z.number(),
  activePositionCount: z.number(),
  underperformers: z.array(UnderperformerSchema),
  overdueForReview: z.array(z.string()),
  llmNarrative: z.string(),
});
export type PortfolioHealthReport = z.infer<typeof PortfolioHealthReportSchema>;
export type Underperformer = z.infer<typeof UnderperformerSchema>;
