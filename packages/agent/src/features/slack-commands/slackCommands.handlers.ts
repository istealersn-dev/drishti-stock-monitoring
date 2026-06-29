import crypto from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { agentLogs, agentRuns, stockConfig } from "../../db/schema.js";
import { chat } from "../../llm/llmClient.js";
import { env } from "../../shared/env.js";
import { listGTTs } from "../gtt/gtt.tools.js";
import { fetchHoldings } from "../portfolio/portfolio.tools.js";

import {
  formatAnalysis,
  formatGtts,
  formatHelp,
  formatHoldings,
  formatPnl,
  formatStatus,
} from "./slackCommands.formatters.js";

type SayFunction = (text: string) => Promise<unknown>;

const CMD_PNL = "cmd_pnl";
const CMD_HOLDINGS = "cmd_holdings";
const CMD_GTTS = "cmd_gtts";
const CMD_ANALYSE = "cmd_analyse";
const CMD_ANALYSE_LLM = "cmd_analyse_llm";
const CMD_ANALYSE_NO_CONFIG = "cmd_analyse_no_config";

const ANALYSE_SYSTEM_PROMPT = `You are Drishti, a portfolio monitoring agent for Indian equities on NSE/BSE, with the expertise of a SEBI-registered investment adviser. You are given a single holding's details and its configured stop-loss, T1, and T2 levels.

Respond in 3-5 sentences covering:
1. Current price relative to entry, SL, and targets — name specific prices and percentages
2. Risk level: tight (SL within 3%), moderate (3–8%), or extended (8%+)
3. One clear recommendation: hold, trail SL, alert only, or exit — with a specific reason

SL discipline to apply:
- If T1 has been hit, recommend trailing SL to break-even at minimum.
- If T2 has been hit, recommend trailing SL aggressively to protect the majority of gains.
- If the position is an MTF holding and has been open beyond 5–7 days without progress, flag the overnight funding cost (~18% annualised).
- SL levels should reference technically significant levels (prior swing lows, key MAs) when possible, not arbitrary percentages.

Lead with the most actionable insight. Flag risk before opportunity. No markdown headers. Plain text only.`;

/**
 * Respond to !status — last agent run, dry-run flag, next poll estimate.
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
export async function handleStatus(say: SayFunction): Promise<void> {
  const lastRun = db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).get() ?? null;

  await say(
    formatStatus({
      lastRun,
      dryRun: env.DRISHTI_DRY_RUN,
      pollIntervalMinutes: env.DRISHTI_POLL_INTERVAL_MINUTES,
    }),
  );
}

/**
 * Respond to !pnl — today's and overall P&L across all holdings.
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
export async function handlePnl(say: SayFunction): Promise<void> {
  const result = await fetchHoldings();
  if (!result.ok) {
    logCommandError(CMD_PNL, result.error.message);
    await say(`⚠️ Could not fetch holdings: ${result.error.message}`);
    return;
  }
  await say(formatPnl(result.value));
}

/**
 * Respond to !holdings — full holdings table with LTP and P&L.
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
export async function handleHoldings(say: SayFunction): Promise<void> {
  const result = await fetchHoldings();
  if (!result.ok) {
    logCommandError(CMD_HOLDINGS, result.error.message);
    await say(`⚠️ Could not fetch holdings: ${result.error.message}`);
    return;
  }
  await say(formatHoldings(result.value));
}

/**
 * Respond to !gtts — active GTT orders from Upstox.
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
export async function handleGtts(say: SayFunction): Promise<void> {
  const result = await listGTTs();
  if (!result.ok) {
    logCommandError(CMD_GTTS, result.error.message);
    await say(`⚠️ Could not fetch GTTs: ${result.error.message}`);
    return;
  }
  await say(formatGtts(result.value));
}

/**
 * Respond to !analyse <stock> — LLM analysis of a single holding.
 * Matches by trading_symbol or company_name (case-insensitive substring).
 * @param query - The stock name or symbol fragment from the user's message
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
/** Strip spaces, hyphens, and dots for fuzzy name comparison. */
function normalize(s: string): string {
  return s.toLowerCase().replaceAll(/[\s\-_.]/g, "");
}

/**
 * Resolve a free-text query to a holding via fuzzy match then LLM fallback.
 * @param query - User-supplied stock name or symbol fragment
 * @param holdings - Current portfolio holdings
 * @returns Matched holding or null
 */
async function resolveHolding(
  query: string,
  holdings: import("../portfolio/portfolio.schema.js").Holding[],
): Promise<import("../portfolio/portfolio.schema.js").Holding | null> {
  const needle = query.toLowerCase().trim();
  const normNeedle = normalize(query);

  // 1. Exact symbol
  const exact = holdings.find((h) => h.trading_symbol.toLowerCase() === needle);
  if (exact) return exact;

  // 2. Symbol contains query
  const symbolContains = holdings.find((h) => h.trading_symbol.toLowerCase().includes(needle));
  if (symbolContains) return symbolContains;

  // 3. Normalized company name prefix (handles "federalbank" → "Federal Bank")
  const normPrefix = holdings.find((h) => normalize(h.company_name).startsWith(normNeedle));
  if (normPrefix) return normPrefix;

  // 4. Normalized company name substring
  const normContains = holdings.find((h) => normalize(h.company_name).includes(normNeedle));
  if (normContains) return normContains;

  // 5. LLM fallback — ask the model to pick the best match from the holdings list
  const symbolList = holdings.map((h) => `${h.trading_symbol} (${h.company_name})`).join("\n");
  try {
    const response = await chat([
      {
        role: "system",
        content:
          "You are a stock symbol resolver. Given a user query and a list of holdings, return ONLY the exact trading symbol that best matches the query. If nothing matches, return the word NONE. No explanation.",
      },
      {
        role: "user",
        content: `Query: "${query}"\n\nHoldings:\n${symbolList}`,
      },
    ]);
    const resolved = response.trim().toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
    if (resolved !== "NONE") {
      const llmMatch = holdings.find((h) => h.trading_symbol === resolved);
      if (llmMatch) return llmMatch;
    }
  } catch {
    // LLM unavailable — fall through to null
  }

  return null;
}

export async function handleAnalyse(query: string, say: SayFunction): Promise<void> {
  const holdingsResult = await fetchHoldings();
  if (!holdingsResult.ok) {
    logCommandError(CMD_ANALYSE, holdingsResult.error.message);
    await say(`⚠️ Could not fetch holdings: ${holdingsResult.error.message}`);
    return;
  }

  const holdings = holdingsResult.value;
  const holding = await resolveHolding(query, holdings);

  if (holding == null) {
    await say(`🔍 No holding matched *${query}*. Use \`!holdings\` to see your current positions.`);
    return;
  }

  const config = db
    .select()
    .from(stockConfig)
    .where(eq(stockConfig.symbol, holding.trading_symbol))
    .get();

  if (config == null) {
    logCommandError(CMD_ANALYSE_NO_CONFIG, "No stock_config row found", holding.trading_symbol);
    await say(
      `ℹ️ No SL/target config found for *${holding.trading_symbol}* — analysis will use price data only. Configure via the dashboard to enable full analysis.`,
    );
    // intentional fall-through: analysis still runs with null SL/target fields
  }

  const pnlPct =
    holding.average_price > 0
      ? ((holding.last_price - holding.average_price) / holding.average_price) * 100
      : 0;

  const snapshot = {
    symbol: holding.trading_symbol,
    company: holding.company_name,
    quantity: holding.quantity,
    averagePrice: holding.average_price,
    lastPrice: holding.last_price,
    pnlRupees: holding.pnl,
    pnlPercent: Number(pnlPct.toFixed(2)),
    dayChange: holding.day_change,
    dayChangePct: holding.day_change_percentage,
    product: holding.product,
    entryLow: config?.entryLow ?? null,
    entryHigh: config?.entryHigh ?? null,
    buyPrice: config?.buyPrice ?? null,
    slThreshold: config?.slThreshold ?? null,
    targetOne: config?.targetOne ?? null,
    targetTwo: config?.targetTwo ?? null,
    targetTwoOpen: config?.targetTwoOpen ?? false,
  };

  await say(`🔍 Analysing *${holding.trading_symbol}*…`);

  try {
    const reasoning = await chat([
      { role: "system", content: ANALYSE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Holding snapshot:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ]);
    await say(formatAnalysis(holding.trading_symbol, reasoning));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logCommandError(CMD_ANALYSE_LLM, message, holding.trading_symbol);

    const isTimeout = message.toLowerCase().includes("timed out") || message.includes("timeout");
    const isOffline =
      !isTimeout &&
      (message.includes("ECONNREFUSED") ||
        message.includes("ECONNRESET") ||
        message.includes("fetch failed") ||
        message.includes("LM Studio returned an empty response"));

    if (isTimeout) {
      await say(
        `⏱️ *Analysis timed out.* LM Studio is busy — likely running a portfolio tick. Try again in ~30 seconds.`,
      );
    } else if (isOffline) {
      await say(
        `⚠️ *LM Studio is offline.* Start it on the Mac Mini and load \`${env.LM_MODEL}\` before using \`analyse\`.`,
      );
    } else {
      await say(`⚠️ LLM analysis failed: ${message}`);
    }
  }
}

/**
 * Respond to /drishti (no subcommand) or /drishti help — list all commands.
 * @param say - Slack say function for the originating channel
 * @returns Resolved when message is sent
 */
export async function handleHelp(say: SayFunction): Promise<void> {
  await say(formatHelp());
}

function logCommandError(action: string, error: string, symbol?: string): void {
  db.insert(agentLogs)
    .values({
      runId: crypto.randomUUID(),
      symbol: symbol ?? null,
      action,
      reasoning: null,
      dryRun: env.DRISHTI_DRY_RUN,
      error,
      createdAt: new Date().toISOString(),
    })
    .run();
}
