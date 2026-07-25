import "dotenv/config";

import bolt from "@slack/bolt";

const { App, SocketModeReceiver } = bolt;

import { startApiServer } from "./api/api.server.js";
import { tick } from "./features/agent/agent.tick.js";
import { registerApprovalHandlers } from "./features/approval/approval.handler.js";
import { startTimeoutPoller } from "./features/approval/approval.timeout.js";
import { startDigestCrons } from "./features/digest/digest.service.js";
import { submitBuyInstruction } from "./features/instructions/instructions.pipeline.js";
import { registerSlackCommands } from "./features/slack-commands/slackCommands.router.js";
import { SlackMessageShape } from "./features/slack-commands/slackCommands.schema.js";
import { startSlackConnectionWatchdog } from "./features/slack-connection/slackConnection.watchdog.js";
import { startAdvisorCrons, startCron } from "./scheduler/cron.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { MENTION_PREFIX_REGEX } from "./shared/slackMention.js";

async function main(): Promise<void> {
  // The receiver is constructed here rather than via `socketMode: true` so we
  // hold a typed reference to its Socket Mode client and can watch the
  // connection (App.receiver is private).
  const receiver = new SocketModeReceiver({ appToken: env.SLACK_APP_TOKEN });

  const boltApp = new App({
    token: env.SLACK_BOT_TOKEN,
    receiver,
  });

  boltApp.error(async (error) => {
    logger.error("Slack Bolt app error", { error: error.message });
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

  // A stranded Socket Mode client leaves the process alive but deaf to Slack —
  // pm2 sees a healthy process while messages go unanswered. Exiting hands the
  // restart to pm2, which is the only reliable way back to a working socket.
  startSlackConnectionWatchdog(receiver.client, {
    // start() has resolved, so the socket is up — seed from the client's real
    // state so the watchdog doesn't count the already-fired `connected` event
    // as missed and kill a healthy process after the grace period.
    initiallyConnected: receiver.client.connected,
    onStalled: (disconnectedForMs) => {
      logger.error("Exiting so the supervisor can restart with a fresh Slack connection", {
        disconnectedForMs,
      });
      process.exit(1);
    },
  });

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
