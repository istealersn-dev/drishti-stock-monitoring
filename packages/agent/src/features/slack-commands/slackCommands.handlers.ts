import crypto from "node:crypto";

import type { SayFn } from "@slack/bolt";
import { desc, eq } from "drizzle-orm";

import { getActiveBrokerClient } from "../../broker/brokerClient.registry.js";
import type { Holding } from "../../broker/brokerClient.types.js";
import { db } from "../../db/db.js";
import { agentLogs, agentRuns, slackSessions, stockConfig } from "../../db/schema.js";
import {
  ADVISOR_LLM_TIMEOUT_MS,
  SYMBOL_RESOLVE_TIMEOUT_MS,
  chatOnce,
} from "../../llm/llmClient.js";
import { isDryRunActive } from "../../shared/dryRun.js";
import { env } from "../../shared/env.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { askAdvisor, generateTradeSetup } from "../advisor/advisor.chain.js";
import { computeHealthReport } from "../health/health.engine.js";
import { formatHealthReport } from "../health/health.formatter.js";
import { resolveSymbol } from "../instructions/instructions.resolver.js";
import { getCachedLevels, saveLevels } from "../technicals/technicals.cache.js";
import type { TechnicalLevels } from "../technicals/technicals.schema.js";
import { fetchOHLCV, computeLevels } from "../technicals/technicals.service.js";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "../watchlist/watchlist.service.js";

import {
  formatAnalysis,
  formatGtts,
  formatHelp,
  formatHoldings,
  formatPnl,
  formatStatus,
} from "./slackCommands.formatters.js";

type SayFunction = SayFn;

type SlackClient = {
  chat: { update: (arguments_: { channel: string; ts: string; text: string }) => Promise<unknown> };
};

const CMD_PNL = "cmd_pnl";
const CMD_HOLDINGS = "cmd_holdings";
const CMD_GTTS = "cmd_gtts";
const CMD_ANALYSE = "cmd_analyse";
const CMD_ANALYSE_LLM = "cmd_analyse_llm";
const CMD_ANALYSE_NO_CONFIG = "cmd_analyse_no_config";
const CMD_RESOLVE_HOLDING_LLM = "cmd_resolve_holding_llm";

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
      dryRun: isDryRunActive(),
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
  const result = await getActiveBrokerClient().fetchHoldings();
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
  const result = await getActiveBrokerClient().fetchHoldings();
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
  const result = await getActiveBrokerClient().listTriggerOrders();
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
async function resolveHolding(query: string, holdings: Holding[]): Promise<Holding | null> {
  const needle = query.toLowerCase().trim();
  const normNeedle = normalize(query);

  // 1. Exact symbol
  const exact = holdings.find((h) => h.tradingSymbol.toLowerCase() === needle);
  if (exact) return exact;

  // 2. Symbol contains query
  const symbolContains = holdings.find((h) => h.tradingSymbol.toLowerCase().includes(needle));
  if (symbolContains) return symbolContains;

  // 3. Normalized company name prefix (handles "federalbank" → "Federal Bank")
  const normPrefix = holdings.find((h) => normalize(h.companyName).startsWith(normNeedle));
  if (normPrefix) return normPrefix;

  // 4. Normalized company name substring
  const normContains = holdings.find((h) => normalize(h.companyName).includes(normNeedle));
  if (normContains) return normContains;

  // 5. LLM fallback — ask the model to pick the best match from the holdings list
  const symbolList = holdings.map((h) => `${h.tradingSymbol} (${h.companyName})`).join("\n");
  try {
    const response = await chatOnce(
      "You are a stock symbol resolver. Given a user query and a list of holdings, return ONLY the exact trading symbol that best matches the query. If nothing matches, return the word NONE. No explanation.",
      `Query: "${query}"\n\nHoldings:\n${symbolList}`,
      { maxTokens: 20, timeoutMs: SYMBOL_RESOLVE_TIMEOUT_MS },
    );
    const resolved = response
      .trim()
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/g, "");
    if (resolved !== "NONE") {
      const llmMatch = holdings.find((h) => h.tradingSymbol === resolved);
      if (llmMatch) return llmMatch;
    }
  } catch (error) {
    // LLM unavailable — fall through to null, but still record the failure
    const message = error instanceof Error ? error.message : String(error);
    logCommandError(CMD_RESOLVE_HOLDING_LLM, message, query);
  }

  return null;
}

export async function handleAnalyse(query: string, say: SayFunction): Promise<void> {
  const holdingsResult = await getActiveBrokerClient().fetchHoldings();
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
    .where(eq(stockConfig.symbol, holding.tradingSymbol))
    .get();

  if (config == null) {
    logCommandError(CMD_ANALYSE_NO_CONFIG, "No stock_config row found", holding.tradingSymbol);
    await say(
      `ℹ️ No SL/target config found for *${holding.tradingSymbol}* — analysis will use price data only. Configure via the dashboard to enable full analysis.`,
    );
    // intentional fall-through: analysis still runs with null SL/target fields
  }

  const pnlPct =
    holding.averagePrice > 0
      ? ((holding.lastPrice - holding.averagePrice) / holding.averagePrice) * 100
      : 0;

  const snapshot = {
    symbol: holding.tradingSymbol,
    company: holding.companyName,
    quantity: holding.quantity,
    averagePrice: holding.averagePrice,
    lastPrice: holding.lastPrice,
    pnlRupees: holding.pnl,
    pnlPercent: Number(pnlPct.toFixed(2)),
    dayChange: holding.dayChange,
    dayChangePct: holding.dayChangePercentage,
    product: holding.product,
    entryLow: config?.entryLow ?? null,
    entryHigh: config?.entryHigh ?? null,
    buyPrice: config?.buyPrice ?? null,
    slThreshold: config?.slThreshold ?? null,
    targetOne: config?.targetOne ?? null,
    targetTwo: config?.targetTwo ?? null,
    targetTwoOpen: config?.targetTwoOpen ?? false,
  };

  await say(`🔍 Analysing *${holding.tradingSymbol}*…`);

  try {
    const reasoning = await chatOnce(
      ANALYSE_SYSTEM_PROMPT,
      `Holding snapshot:\n${JSON.stringify(snapshot, null, 2)}`,
      { timeoutMs: ADVISOR_LLM_TIMEOUT_MS },
    );
    await say(formatAnalysis(holding.tradingSymbol, reasoning));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logCommandError(CMD_ANALYSE_LLM, message, holding.tradingSymbol);
    await say(`⚠️ Analysis failed: ${message}`);
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

const SETUP_HISTORY_DAYS = 260;

/**
 * Handle a question to Drishti — from slash command, thread reply, or @mention.
 * Posts a "Thinking…" placeholder then replaces it with the answer in-place.
 * If threadTs is provided the reply is posted inside that thread.
 * Returns the posted message ts + channel so the caller can persist the session.
 * @param question - The advisory question
 * @param say - Slack say function (channel-scoped)
 * @param client - Slack web client for chat.update
 * @param opts.sessionId - Conversation session (caller generates or looks up)
 * @param opts.threadTs - If set, reply inside this thread
 * @returns The message ts and channel of the posted reply
 */
export async function handleAsk(
  question: string,
  say: SayFunction,
  client: SlackClient,
  options: { sessionId: string; threadTs?: string },
): Promise<{ ts: string | undefined; channel: string | undefined }> {
  const thinkingPayload = options.threadTs
    ? { text: "🤔 Thinking…", thread_ts: options.threadTs }
    : "🤔 Thinking…";

  const thinkingMessage = await say(thinkingPayload);

  const result = await askAdvisor({ question, sessionId: options.sessionId, channel: "slack" });
  const finalText = result.ok
    ? `> ${question}\n\n${result.value.answer}`
    : ((): string => {
        logCommandError("advisor_ask", result.error.message);
        return `⚠️ Advisory query failed: ${result.error.message}`;
      })();

  const ts = thinkingMessage.ts ? String(thinkingMessage.ts) : undefined;
  const channel = thinkingMessage.channel ? String(thinkingMessage.channel) : undefined;

  if (ts && channel) {
    await client.chat.update({ channel, ts, text: finalText });
  } else {
    await say(finalText);
  }

  return { ts, channel };
}

/**
 * Persist a new Slack session after a slash-command reply is posted.
 * @param threadTs - The ts of Drishti's reply (becomes the thread root)
 * @param channel - Slack channel id
 * @param sessionId - The session id used for this conversation
 */
export function storeSlackSession(threadTs: string, channel: string, sessionId: string): void {
  const now = new Date().toISOString();
  db.insert(slackSessions)
    .values({ threadTs, channel, sessionId, lastActiveAt: now })
    .onConflictDoUpdate({
      target: slackSessions.threadTs,
      set: { lastActiveAt: now },
    })
    .run();
}

/**
 * Fetch or compute technical levels for a symbol, caching the result.
 * @param symbol - Trading symbol
 * @param instrumentKey - Upstox instrument key
 * @returns Result with technical levels or an Error
 */
async function fetchOrComputeLevels(
  symbol: string,
  instrumentKey: string,
): Promise<Result<TechnicalLevels, Error>> {
  const cached = getCachedLevels(symbol);
  if (cached) return ok(cached);

  const ohlcvResult = await fetchOHLCV(instrumentKey, SETUP_HISTORY_DAYS);
  if (!ohlcvResult.ok) {
    return err(new Error(`Could not fetch price history: ${ohlcvResult.error.message}`));
  }
  const levels = computeLevels(symbol, ohlcvResult.value);
  saveLevels(levels);
  return ok(levels);
}

/**
 * Handle `/drishti setup <stock>` — generates a trade setup using technical levels.
 * @param stockName - Free-text stock name or symbol
 * @param say - Slack say function
 * @returns Resolved when setup card is posted
 */
export async function handleSetup(stockName: string, say: SayFunction): Promise<void> {
  await say(`📊 Generating trade setup for *${stockName}*…`);

  const resolveResult = await resolveSymbol(stockName);
  if (!resolveResult.ok) {
    await say(`⚠️ Could not resolve symbol for *${stockName}*: ${resolveResult.error.message}`);
    return;
  }
  const { tradingSymbol, instrumentToken } = resolveResult.value;

  const levelsResult = await fetchOrComputeLevels(tradingSymbol, instrumentToken);
  if (!levelsResult.ok) {
    await say(`⚠️ ${levelsResult.error.message}`);
    return;
  }

  const setupResult = await generateTradeSetup(tradingSymbol, JSON.stringify(levelsResult.value));
  if (!setupResult.ok) {
    logCommandError("advisor_setup", setupResult.error.message, tradingSymbol);
    await say(`⚠️ Trade setup generation failed: ${setupResult.error.message}`);
    return;
  }
  const setup = setupResult.value;

  const t1 = setup.targets[0];
  const t2 = setup.targets[1];
  const targetString = [
    t1 ? `T1 ₹${t1.price}${t1.isOpenEnded ? "+" : ""}` : null,
    t2 ? `T2 ₹${t2.price}${t2.isOpenEnded ? "+" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tgtPrices = setup.targets.map((t) => `${t.price}${t.isOpenEnded ? "+" : ""}`).join(" ");
  const buyInstructionText = `${tradingSymbol} Buy ${setup.entryLow}-${setup.entryHigh} SL ${setup.stopLoss} Tgt ${tgtPrices}`;

  const risk = setup.entryHigh - setup.stopLoss;
  const reward = t1 ? t1.price - setup.entryHigh : null;
  const rrLabel = risk > 0 && reward !== null ? `1:${(reward / risk).toFixed(1)}` : "N/A";

  await say({
    text: `📈 Trade Setup — ${tradingSymbol}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📈 Trade Setup — ${tradingSymbol}`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Entry Range*\n₹${setup.entryLow} – ₹${setup.entryHigh}` },
          { type: "mrkdwn", text: `*Stop Loss*\n₹${setup.stopLoss}` },
          { type: "mrkdwn", text: `*R:R (to T1)*\n${rrLabel}` },
          { type: "mrkdwn", text: `*Targets*\n${targetString}` },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Rationale*\n${setup.rationale}` },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `To submit as a buy instruction:\n\`${buyInstructionText}\``,
        },
      },
    ],
  });
}

/**
 * Handle `/drishti health` — compute and post the portfolio health report.
 * @param say - Slack say function
 * @returns Resolved when report is posted
 */
export async function handleHealth(say: SayFunction): Promise<void> {
  await say("🔍 Computing portfolio health…");
  const result = await computeHealthReport();
  if (!result.ok) {
    logCommandError("health_report", result.error.message);
    await say(`⚠️ Health report failed: ${result.error.message}`);
    return;
  }
  await say(formatHealthReport(result.value));
}

/**
 * Handle `/drishti watchlist` — list all watchlist stocks.
 * @param say - Slack say function
 * @returns Resolved when list is posted
 */
export async function handleWatchlistList(say: SayFunction): Promise<void> {
  const entries = getWatchlist();
  if (entries.length === 0) {
    await say(
      "📋 Watchlist is empty. Add stocks with `/drishti watchlist add SYMBOL Display Name`",
    );
    return;
  }
  const lines = entries.map(
    (e) => `• *${e.symbol}* — ${e.displayName}${e.notes ? ` (${e.notes})` : ""}`,
  );
  await say(`📋 *Watchlist (${entries.length})*\n\n${lines.join("\n")}`);
}

/**
 * Handle `/drishti watchlist add SYMBOL Display Name` — add a stock to the watchlist.
 * @param args - Remaining text after "watchlist add " (symbol followed by display name)
 * @param say - Slack say function
 * @returns Resolved when confirmation is posted
 */
export async function handleWatchlistAdd(arguments_: string, say: SayFunction): Promise<void> {
  const parts = arguments_.trim().split(/\s+/);
  const symbol = parts[0];
  const displayName = parts.slice(1).join(" ");

  if (!symbol || !displayName) {
    await say(
      "Usage: `/drishti watchlist add SYMBOL Display Name`\nExample: `/drishti watchlist add HDFCBANK HDFC Bank`",
    );
    return;
  }

  const result = addToWatchlist(symbol.toUpperCase(), displayName);
  if (!result.ok) {
    await say(`⚠️ ${result.error.message}`);
    return;
  }
  await say(`✅ Added *${symbol.toUpperCase()}* to watchlist.`);
}

/**
 * Handle `/drishti watchlist remove SYMBOL` — remove a stock from the watchlist.
 * @param symbol - The symbol to remove
 * @param say - Slack say function
 * @returns Resolved when confirmation is posted
 */
export async function handleWatchlistRemove(symbol: string, say: SayFunction): Promise<void> {
  const result = removeFromWatchlist(symbol.trim().toUpperCase());
  if (!result.ok) {
    await say(`⚠️ ${result.error.message}`);
    return;
  }
  await say(`✅ Removed *${symbol.trim().toUpperCase()}* from watchlist.`);
}

function logCommandError(action: string, error: string, symbol?: string): void {
  db.insert(agentLogs)
    .values({
      runId: crypto.randomUUID(),
      symbol: symbol ?? null,
      action,
      reasoning: null,
      dryRun: isDryRunActive(),
      error,
      createdAt: new Date().toISOString(),
    })
    .run();
}
