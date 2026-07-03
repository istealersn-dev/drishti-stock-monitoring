import "dotenv/config";

import bolt from "@slack/bolt";

const { App } = bolt;

import { startApiServer } from "./api/api.server.js";
import { tick } from "./features/agent/agent.tick.js";
import { registerApprovalHandlers } from "./features/approval/approval.handler.js";
import { startTimeoutPoller } from "./features/approval/approval.timeout.js";
import { startDigestCrons } from "./features/digest/digest.service.js";
import { submitBuyInstruction } from "./features/instructions/instructions.pipeline.js";
import { registerSlackCommands } from "./features/slack-commands/slackCommands.router.js";
import { SlackMessageShape } from "./features/slack-commands/slackCommands.schema.js";
import { startAdvisorCrons, startCron } from "./scheduler/cron.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { MENTION_PREFIX_REGEX } from "./shared/slackMention.js";

async function main(): Promise<void> {
  const boltApp = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  registerApprovalHandlers(boltApp);
  registerSlackCommands(boltApp, env.SLACK_COMMAND_CHANNEL_ID);

  // Plain-message buy instructions in command/alert channels.
  // Requires "buy" + at least one digit (price) to avoid misrouting advisory questions.
  // Skips @mentions entirely — those are handled exclusively by the app_mention
  // handler's LLM classifier (registerSlackCommands), which Slack fires as a
  // *separate* event for the same message. Without this guard, a buy instruction
  // sent as "@drishti Buy X 100 SL 90" triggered both handlers independently,
  // risking two separate submitBuyInstruction calls (and potentially two approval
  // cards) for the same instruction.
  const BUY_INSTRUCTION = /\bbuy\b.*\d/i;
  const buyChannels = new Set([env.SLACK_ALERT_CHANNEL_ID, env.SLACK_COMMAND_CHANNEL_ID]);
  boltApp.message(async ({ message }) => {
    if (message.subtype) return;
    const parsed = SlackMessageShape.safeParse(message);
    if (!parsed.success) return;
    const { channel, text } = parsed.data;
    if (!channel || !buyChannels.has(channel) || !text) return;
    if (/^!/.test(text) || /^\//.test(text) || MENTION_PREFIX_REGEX.test(text.trim())) return;
    if (!BUY_INSTRUCTION.test(text)) return;
    const result = await submitBuyInstruction(text, channel);
    if (!result.ok) {
      logger.error("Plain-message buy instruction failed", { channel, error: result.error });
    }
  });

  await boltApp.start();
  logger.info("Slack Bolt app started (socket mode)");

  startTimeoutPoller();
  startDigestCrons();
  startAdvisorCrons();
  await startApiServer();

  await tick();
  startCron(tick);
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
