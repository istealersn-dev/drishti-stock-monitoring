import type { App } from "@slack/bolt";

import { logger } from "../../shared/logger.js";

import { routeCommand } from "./slackCommands.command.js";
import {
  handleAnalyse,
  handleGtts,
  handleHoldings,
  handlePnl,
  handleStatus,
} from "./slackCommands.handlers.js";
import { SlackMessageShape } from "./slackCommands.schema.js";

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
}
