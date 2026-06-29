import type { PortfolioHealthReport } from "./health.schema.js";

let lastReport: PortfolioHealthReport | null = null;

/**
 * Return the most recently computed health report, or null if none has been computed yet.
 * @returns The cached report or null
 */
export function getLastHealthReport(): PortfolioHealthReport | null {
  return lastReport;
}

/**
 * Store a freshly computed health report so GET /api/health can serve it without recomputing.
 * Called by POST /api/health/run and the weekly Sunday cron.
 * @param report - The computed portfolio health report
 */
export function setLastHealthReport(report: PortfolioHealthReport): void {
  lastReport = report;
}
