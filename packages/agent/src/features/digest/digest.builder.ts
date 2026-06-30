import type { Holding } from "../portfolio/portfolio.schema.js";

const MTF_ANNUAL_RATE = 0.18;
const DAYS_IN_YEAR = 365;
const MTF_PRODUCT = "MTF";

export type DigestInput = {
  holdings: Holding[];
  activeGttCount: number;
  pendingApprovalCount: number;
  todayBreachCount: number;
  todayTargetHitCount: number;
  todayDecisionCount: number;
  type: "morning" | "closing";
  watchlistProximityAlerts?: string[];
};

/**
 * Calculate the daily MTF interest burn-rate across all leveraged holdings.
 * @param holdings - Portfolio holdings
 * @returns Daily interest in rupees (0 if no MTF positions)
 */
export function calculateMtfBurnRate(holdings: Holding[]): number {
  const mtfHoldings = holdings.filter((h) => h.product === MTF_PRODUCT);
  const totalValue = mtfHoldings.reduce((sum, h) => sum + h.quantity * h.average_price, 0);
  return Number(((totalValue * MTF_ANNUAL_RATE) / DAYS_IN_YEAR).toFixed(2));
}

/**
 * Count holdings without an active GTT (proxy: product is not MTF and pnl is negative — rough heuristic).
 * In practice the caller should pass this count from the gtt_orders table.
 * @param holdings - Portfolio holdings
 * @param activeGttCount - Number of active GTT orders in DB
 * @returns Number of holdings likely missing SL coverage
 */
export function estimateUncoveredCount(holdings: Holding[], activeGttCount: number): number {
  return Math.max(0, holdings.length - activeGttCount);
}

function formatInr(amount: number): string {
  if (Math.abs(amount) >= 100_000) {
    return `₹${(amount / 100_000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Build the morning digest message (posted at 09:15 IST).
 * @param input - Digest data snapshot
 * @returns Formatted Slack message string
 */
export function buildMorningDigest(input: DigestInput): string {
  const totalValue = input.holdings.reduce((sum, h) => sum + h.quantity * h.last_price, 0);
  const totalPnl = input.holdings.reduce((sum, h) => sum + h.pnl, 0);
  const mtfBurn = calculateMtfBurnRate(input.holdings);
  const uncovered = estimateUncoveredCount(input.holdings, input.activeGttCount);

  const lines: string[] = [
    `📊 *Drishti Morning Briefing* — ${formatDate()}`,
    "",
    `*Portfolio* — ${input.holdings.length} holdings, ${formatInr(totalValue)} deployed`,
    `*P&L* — ${totalPnl >= 0 ? "+" : ""}${formatInr(totalPnl)}`,
    `*Active GTTs* — ${input.activeGttCount} SL orders live`,
  ];

  if (uncovered > 0) {
    lines.push(
      `⚠️ *SL Coverage gap* — ${uncovered} holding${uncovered > 1 ? "s" : ""} without GTT`,
    );
  }

  if (mtfBurn > 0) {
    lines.push(`💸 *MTF burn rate* — ${formatInr(mtfBurn)}/day`);
  }

  if (input.pendingApprovalCount > 0) {
    lines.push(`🔔 *Pending approvals* — ${input.pendingApprovalCount} awaiting action`);
  }

  const alerts = input.watchlistProximityAlerts;
  if (alerts && alerts.length > 0) {
    lines.push("", "📍 *Watchlist — Near Entry*");
    for (const alert of alerts) {
      lines.push(`  • ${alert}`);
    }
  }

  lines.push("", "Market opens at 09:15. Good luck. 🟢");

  return lines.join("\n");
}

/**
 * Build the closing digest message (posted at 15:30 IST).
 * @param input - Digest data snapshot
 * @returns Formatted Slack message string
 */
export function buildClosingDigest(input: DigestInput): string {
  const totalPnl = input.holdings.reduce((sum, h) => sum + h.pnl, 0);
  const dayPnl = input.holdings.reduce((sum, h) => sum + h.day_change * h.quantity, 0);

  const lines: string[] = [
    `📊 *Drishti Closing Summary* — ${formatDate()}`,
    "",
    `*Day P&L* — ${dayPnl >= 0 ? "+" : ""}${formatInr(dayPnl)}`,
    `*Total P&L* — ${totalPnl >= 0 ? "+" : ""}${formatInr(totalPnl)}`,
    "",
    `*SL Breaches today* — ${input.todayBreachCount}`,
    `*Target hits today* — ${input.todayTargetHitCount}`,
    `*LLM decisions* — ${input.todayDecisionCount}`,
    "",
    `*Active GTTs* — ${input.activeGttCount}`,
  ];

  if (input.pendingApprovalCount > 0) {
    lines.push(
      `🔔 *Pending approvals* — ${input.pendingApprovalCount} (will expire after timeout)`,
    );
  }

  lines.push("", "Market closed. 🔴 See you tomorrow.");

  return lines.join("\n");
}
