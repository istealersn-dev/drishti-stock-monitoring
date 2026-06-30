import crypto from "node:crypto";

import type { App } from "@slack/bolt";
import { eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { slackSessions } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { submitBuyInstruction } from "../instructions/instructions.pipeline.js";

import { routeCommand } from "./slackCommands.command.js";
import {
  handleAnalyse,
  handleAsk,
  handleGtts,
  handleHealth,
  handleHelp,
  handleHoldings,
  handlePnl,
  handleSetup,
  handleStatus,
  handleWatchlistAdd,
  handleWatchlistList,
  handleWatchlistRemove,
  storeSlackSession,
} from "./slackCommands.handlers.js";
import { SlackMessageShape } from "./slackCommands.schema.js";

const BUY_INSTRUCTION = /\bbuy\b.*\d/i;
const MENTION_PREFIX = /^<@[A-Z0-9]+>\s*/i;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Look up an existing tracked Drishti thread by its root ts.
 * Returns the session_id if found and within the 24h TTL, else null.
 * @param threadTs - Root message ts to look up
 */
function getExistingSession(threadTs: string): string | null {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  const row = db.select().from(slackSessions).where(eq(slackSessions.threadTs, threadTs)).get();
  if (!row || row.lastActiveAt < cutoff) return null;
  return row.sessionId;
}

/**
 * Register all Slack command and event listeners on the Bolt app.
 * @param app - The Slack Bolt app instance
 * @param commandChannelId - The channel ID for !command messages
 */
export function registerSlackCommands(app: App, commandChannelId: string): void {

  // ── !command messages (command channel only) ──────────────────────────────
  app.message(async ({ message, say }) => {
    if (message.subtype) return;
    const parsed = SlackMessageShape.safeParse(message);
    if (!parsed.success || parsed.data.channel !== commandChannelId || !parsed.data.text) return;

    const matched = routeCommand(parsed.data.text.trim());
    if (matched == null) return;

    logger.info("Slack command received", { command: matched.command });

    try {
      if (matched.command === "status") await handleStatus(say);
      else if (matched.command === "pnl") await handlePnl(say);
      else if (matched.command === "holdings") await handleHoldings(say);
      else if (matched.command === "gtts") await handleGtts(say);
      else if (matched.command === "analyse" && matched.query != null)
        await handleAnalyse(matched.query, say);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Slack command handler threw", { command: matched.command, error: msg });
      await say(`⚠️ Unexpected error handling \`!${matched.command}\`. Check agent logs.`);
    }
  });

  // ── Thread reply listener ─────────────────────────────────────────────────
  // Plain replies inside a tracked Drishti thread — no slash command or @mention needed.
  // Guards: skips bot messages, @mention messages (handled by app_mention), untracked threads.
  app.message(async ({ message, say, client }) => {
    if (message.subtype) return;

    const parsed = SlackMessageShape.safeParse(message);
    if (!parsed.success || !parsed.data.text || !parsed.data.thread_ts) return;

    const { text, thread_ts, channel } = parsed.data;

    if ("bot_id" in message && message.bot_id) return;
    if (MENTION_PREFIX.test(text.trim())) return;
    if (channel === commandChannelId && routeCommand(text.trim()) != null) return;

    const sessionId = getExistingSession(thread_ts);
    if (!sessionId) return;

    logger.info("Thread reply received", { thread_ts, channel });

    try {
      await handleAsk(text.trim(), say, client, { sessionId, threadTs: thread_ts });
      storeSlackSession(thread_ts, channel, sessionId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Thread reply handler threw", { error: msg });
      await say({ text: `⚠️ Something went wrong: ${msg}`, thread_ts });
    }
  });

  // ── @drishti mention handler ──────────────────────────────────────────────
  // Works in any channel. Top-level mentions start a new session threaded under
  // the reply. Mentions inside an existing tracked thread continue that session.
  app.event("app_mention", async ({ event, say, client }) => {
    const rawText = "text" in event ? String(event.text) : "";
    const question = rawText.replace(MENTION_PREFIX, "").trim();
    if (!question) return;

    const channel = event.channel;
    const eventThreadTs = "thread_ts" in event && event.thread_ts ? String(event.thread_ts) : null;

    // Re-use existing session if we're inside a tracked thread
    const existingSessionId = eventThreadTs ? getExistingSession(eventThreadTs) : null;
    const sessionId = existingSessionId ?? crypto.randomUUID();
    const replyThreadTs = eventThreadTs ?? String(event.ts);

    logger.info("@mention received", { channel, hasThread: !!eventThreadTs, newSession: !existingSessionId });

    try {
      await handleAsk(question, say, client, { sessionId, threadTs: replyThreadTs });

      // Store session so future plain thread replies are picked up.
      // Use replyThreadTs (always defined) rather than posted.ts to avoid
      // silently dropping sessions when say() returns without a ts.
      if (!existingSessionId) {
        storeSlackSession(replyThreadTs, channel, sessionId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("@mention handler threw", { error: msg });
      await say({ text: `⚠️ Something went wrong: ${msg}`, thread_ts: replyThreadTs });
    }
  });

  // ── /drishti slash command ────────────────────────────────────────────────
  app.command("/drishti", async ({ command, ack, say, client }) => {
    await ack();

    const reply = say;
    const sub = command.text.trim().toLowerCase();
    logger.info("Slash command received", { subcommand: sub || "help" });

    try {
      if (sub === "" || sub === "help") {
        await handleHelp(reply);
      } else if (sub === "status") {
        await handleStatus(reply);
      } else if (sub === "pnl") {
        await handlePnl(reply);
      } else if (sub === "holdings") {
        await handleHoldings(reply);
      } else if (sub === "gtts") {
        await handleGtts(reply);
      } else if (sub.startsWith("analyse ")) {
        const query = sub.slice("analyse ".length).trim();
        if (query.length > 0) await handleAnalyse(query, reply);
        else await reply("Usage: `/drishti analyse <symbol or name>`");
      } else if (sub.startsWith("ask ")) {
        const question = command.text.trim().slice("ask ".length).trim();
        if (question.length > 0) {
          const sessionId = crypto.randomUUID();
          const posted = await handleAsk(question, reply, client, { sessionId });
          if (posted.ts && posted.channel) storeSlackSession(posted.ts, posted.channel, sessionId);
        }
      } else if (sub.startsWith("setup ")) {
        const stockName = command.text.trim().slice("setup ".length).trim();
        if (stockName.length > 0) await handleSetup(stockName, reply);
        else await reply("Usage: `/drishti setup <stock name or symbol>`");
      } else if (sub === "health") {
        await handleHealth(reply);
      } else if (sub === "watchlist" || sub === "watchlist list") {
        await handleWatchlistList(reply);
      } else if (sub.startsWith("watchlist add ")) {
        await handleWatchlistAdd(command.text.trim().slice("watchlist add ".length), reply);
      } else if (sub.startsWith("watchlist remove ")) {
        await handleWatchlistRemove(command.text.trim().slice("watchlist remove ".length).trim(), reply);
      } else if (BUY_INSTRUCTION.test(sub)) {
        await reply("📥 Received buy instruction — parsing…");
        const result = await submitBuyInstruction(command.text.trim(), command.channel_id);
        if (!result.ok) {
          await reply(`⚠️ Could not process instruction: ${result.error}`);
        } else {
          await reply(
            `✅ Approval card sent for *${result.symbol}* — check <#${env.SLACK_ALERT_CHANNEL_ID}> to approve.`,
          );
        }
      } else {
        // Anything unrecognised → ask Drishti, store the thread as a session
        const sessionId = crypto.randomUUID();
        const posted = await handleAsk(command.text.trim(), reply, client, { sessionId });
        if (posted.ts && posted.channel) storeSlackSession(posted.ts, posted.channel, sessionId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Slash command handler threw", { subcommand: sub, error: msg });
      await reply(`⚠️ Unexpected error handling \`/drishti ${sub}\`. Check agent logs.`);
    }
  });
}
