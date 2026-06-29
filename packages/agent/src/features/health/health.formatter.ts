import type { PortfolioHealthReport } from "./health.schema.js";

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Render a portfolio health report as a plain-text Slack message.
 * @param report - The computed portfolio health report
 * @returns A formatted Slack message string
 */
export function formatHealthReport(report: PortfolioHealthReport): string {
  const underperformerSymbols =
    report.underperformers.length > 0
      ? report.underperformers.map((u) => u.symbol).join(", ")
      : "none";
  const overdueSymbols =
    report.overdueForReview.length > 0 ? report.overdueForReview.join(", ") : "none";

  const lines: string[] = [
    `📊 *Portfolio Health Report* — ${formatDate(report.generatedAt)}`,
    "",
    `💰 Total Value: ${formatInr(report.totalPortfolioValue)}`,
    `⚠️  Capital at Risk: ${formatInr(report.totalCapitalAtRisk)} (${report.capitalAtRiskPct.toFixed(1)}%)`,
    `🔥 MTF Burn Rate: ${formatInr(report.mtfBurnRateMonthly)}/month`,
    "",
    `${report.underperformers.length} underperformer(s): ${underperformerSymbols}`,
    `${report.overdueForReview.length} position(s) need SL config: ${overdueSymbols}`,
    "",
    report.llmNarrative,
  ];

  return lines.join("\n");
}
