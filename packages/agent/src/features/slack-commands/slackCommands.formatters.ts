import type { GttOrder } from "../gtt/gtt.schema.js";
import type { Holding } from "../portfolio/portfolio.schema.js";

export type RunSummary = {
  startedAt: string;
  status: string;
  summary: string | null;
};

export type StatusInput = {
  lastRun: RunSummary | null;
  dryRun: boolean;
  pollIntervalMinutes: number;
};

function inr(amount: number): string {
  const abs = Math.abs(amount);
  const formatted =
    abs >= 100_000
      ? `₹${(abs / 100_000).toFixed(1)}L`
      : `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

function sign(n: number): string {
  return n >= 0 ? "+" : "";
}

function elapsedMinutes(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
}

function elapsedLabel(isoString: string): string {
  const min = elapsedMinutes(isoString);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  return `${hours}h ${min % 60}m ago`;
}

/**
 * Format the !status command reply.
 * @param input - Last run info plus agent configuration
 * @returns Slack-formatted status string
 */
export function formatStatus(input: StatusInput): string {
  const { lastRun, dryRun, pollIntervalMinutes } = input;

  const body: string[] = [];

  if (lastRun == null) {
    body.push("No runs recorded yet.");
  } else {
    const elapsed = elapsedLabel(lastRun.startedAt);
    const elapsedClamped = Math.max(0, elapsedMinutes(lastRun.startedAt));
    const remainder = elapsedClamped % pollIntervalMinutes;
    const nextInMinutes = remainder === 0 ? 0 : pollIntervalMinutes - remainder;
    body.push(`*Last run* — ${elapsed} (${lastRun.status})`);
    if (lastRun.summary != null) body.push(`*Summary* — ${lastRun.summary}`);
    body.push(`*Next poll* — in ~${nextInMinutes}m`);
  }

  body.push(`*Dry-run* — ${dryRun ? "ON ⚠️" : "OFF"}`);
  return `🤖 *Drishti Status*\n\n${body.join("\n")}`;
}

/**
 * Format the !pnl command reply.
 * @param holdings - Current portfolio holdings
 * @returns Slack-formatted P&L summary
 */
export function formatPnl(holdings: Holding[]): string {
  if (holdings.length === 0) return "📊 No holdings found.";

  const dayPnl = holdings.reduce((sum, h) => sum + h.day_change * h.quantity, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalValue = holdings.reduce((sum, h) => sum + h.last_price * h.quantity, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.average_price * h.quantity, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const sorted = [...holdings].sort(
    (a, b) => Math.abs(b.day_change * b.quantity) - Math.abs(a.day_change * a.quantity),
  );
  const movers = sorted.slice(0, 5);

  const lines: string[] = [
    "📊 *Portfolio P&L*",
    "",
    `*Day P&L* — ${sign(dayPnl)}${inr(dayPnl)}`,
    `*Overall P&L* — ${sign(totalPnl)}${inr(totalPnl)} (${sign(totalPnlPct)}${totalPnlPct.toFixed(1)}%)`,
    `*Deployed* — ${inr(totalValue)}`,
    "",
    "*Top movers today*",
  ];

  for (const h of movers) {
    const dayAmount = h.day_change * h.quantity;
    const arrow = dayAmount >= 0 ? "▲" : "▼";
    lines.push(
      `${arrow} ${h.trading_symbol}  ${sign(dayAmount)}${inr(dayAmount)}  (${sign(h.day_change_percentage)}${h.day_change_percentage.toFixed(1)}%)`,
    );
  }

  return lines.join("\n");
}

/**
 * Format the !holdings command reply.
 * @param holdings - Current portfolio holdings
 * @returns Slack-formatted holdings table
 */
export function formatHoldings(holdings: Holding[]): string {
  if (holdings.length === 0) return "📋 No holdings found.";

  const lines: string[] = [`📋 *Holdings (${holdings.length})*`, ""];

  for (const h of holdings) {
    const pnlPct = h.average_price > 0 ? (h.pnl / (h.average_price * h.quantity)) * 100 : 0;
    const pnlLabel = `${sign(h.pnl)}${inr(h.pnl)} (${sign(pnlPct)}${pnlPct.toFixed(1)}%)`;
    lines.push(
      `*${h.trading_symbol}*  ×${h.quantity}  LTP ₹${h.last_price.toLocaleString("en-IN")}  P&L ${pnlLabel}`,
    );
  }

  return lines.join("\n");
}

/**
 * Format the !gtts command reply.
 * @param gtts - Active GTT orders from Upstox
 * @returns Slack-formatted GTT summary
 */
export function formatGtts(gtts: GttOrder[]): string {
  if (gtts.length === 0) return "🔔 No GTT orders found.";

  const activeCount = gtts.reduce(
    (count, g) => count + (g.status.toLowerCase() === "active" ? 1 : 0),
    0,
  );
  const lines: string[] = [`🔔 *GTT Orders — ${activeCount} active of ${gtts.length} total*`, ""];

  for (const g of gtts) {
    const statusEmoji = g.status.toLowerCase() === "active" ? "🟢" : "⚪";
    const side = g.transaction_type === "SELL" ? "SL" : "BUY";
    lines.push(
      `${statusEmoji} *${g.trading_symbol}*  ${side} @₹${g.trigger_price.toLocaleString("en-IN")}  ×${g.quantity}  _${g.status}_`,
    );
  }

  return lines.join("\n");
}

/**
 * Format the !analyse command reply using an LLM reasoning string.
 * @param symbol - The resolved trading symbol
 * @param reasoning - Free-text LLM analysis
 * @returns Slack-formatted analysis
 */
export function formatAnalysis(symbol: string, reasoning: string): string {
  return `🔍 *Analysis — ${symbol}*\n\n${reasoning}`;
}

/**
 * Format the /drishti help reply listing all available commands.
 * @returns Slack-formatted help string
 */
export function formatHelp(): string {
  return [
    "👁️ *Drishti — Available Commands*",
    "",
    "*Slash command*",
    "`/drishti [subcommand]` — run any command below via slash",
    "",
    "*Message commands* (in #drishti-commands)",
    "`!status` — agent health, last run, dry-run mode, next poll",
    "`!pnl` — portfolio P&L summary and top movers",
    "`!holdings` — full holdings list with LTP and P&L",
    "`!gtts` — active GTT orders",
    "`!analyse <symbol or name>` — LLM analysis of a specific holding",
    "",
    "*Buy instruction* (in #drishti-commands or #drishti-alerts)",
    "`Ramco Systems Buy 560-580 SL 520 Tgt 680 800+`",
    "↳ Sends an approval card — tap Approve to place the GTT entry order.",
    "",
    "*Automated alerts* (no command needed)",
    "• SL breach → GTT exit placed, Slack notified",
    "• T1 / T2 hit → alert ping",
    "• Morning digest at 09:15 IST · EOD digest at 15:30 IST",
  ].join("\n");
}
