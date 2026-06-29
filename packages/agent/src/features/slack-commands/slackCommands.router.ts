import type { App } from "@slack/bolt";

import { submitBuyInstruction } from "../instructions/instructions.pipeline.js";
import { logger } from "../../shared/logger.js";

import { routeCommand } from "./slackCommands.command.js";
import {
  handleAnalyse,
  handleGtts,
  handleHelp,
  handleHoldings,
  handlePnl,
  handleStatus,
} from "./slackCommands.handlers.js";
import { SlackMessageShape } from "./slackCommands.schema.js";

const BUY_KEYWORD = /\bbuy\b/i;

/**
 * Register the Slack command message listener on the Bolt app.
 * Commands are only processed from the configured command channel.
 * @param app - The Slack Bolt app instance
 * @param commandChannelId - The Slack channel ID to listen on
 * @returns void
 */
export function registerSlackCommands(app: App, commandChannelId: string): void {
  app.message(async ({ message, say }) => {
    if (message.subtype) return;
    const parsed = SlackMessageShape.safeParse(message);
    if (!parsed.success || parsed.data.channel !== commandChannelId || !parsed.data.text) return;

    const matched = routeCommand(parsed.data.text.trim());
    if (matched == null) return;

    logger.info("Slack command received", { command: matched.command });

    try {
      if (matched.command === "status") {
        await handleStatus(say);
      } else if (matched.command === "pnl") {
        await handlePnl(say);
      } else if (matched.command === "holdings") {
        await handleHoldings(say);
      } else if (matched.command === "gtts") {
        await handleGtts(say);
      } else if (matched.command === "analyse" && matched.query != null) {
        await handleAnalyse(matched.query, say);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Slack command handler threw", {
        command: matched.command,
        error: errorMessage,
      });
      await say(`⚠️ Unexpected error handling \`!${matched.command}\`. Check agent logs.`);
    }
  });

  // /drishti slash command — posts responses to the channel for full history
  app.command("/drishti", async ({ command, ack, say }) => {
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
        if (query.length > 0) {
          await handleAnalyse(query, reply);
        } else {
          await reply("Usage: `/drishti analyse <symbol or name>`");
        }
      } else if (BUY_KEYWORD.test(sub)) {
        await reply("📥 Received buy instruction — parsing…");
        const result = await submitBuyInstruction(command.text.trim(), command.channel_id);
        if (!result.ok) {
          await reply(`⚠️ Could not process instruction: ${result.error}`);
        }
      } else {
        await reply(`Unknown subcommand \`${sub}\`. Try \`/drishti help\` for the full list.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Slash command handler threw", { subcommand: sub, error: errorMessage });
      await reply(`⚠️ Unexpected error handling \`/drishti ${sub}\`. Check agent logs.`);
    }
  });
}
