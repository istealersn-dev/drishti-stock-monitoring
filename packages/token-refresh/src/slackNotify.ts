import { WebClient } from "@slack/web-api";
import { config } from "dotenv";

const REPO_ROOT = new URL("../../../", import.meta.url);
config({ path: new URL(".env", REPO_ROOT).pathname });
config({ path: new URL(".env.local", REPO_ROOT).pathname, override: true });

let client: WebClient | undefined;

function getClient(): WebClient {
  client ??= new WebClient(process.env.SLACK_BOT_TOKEN);
  return client;
}

/**
 * Posts a message to Drishti's configured Slack alert channel. Never throws — a
 * missing channel id or a Slack API failure is logged to stderr and swallowed, since
 * alerting must not crash the refresh script it's reporting on.
 * @param message - The alert text (mrkdwn-formatted).
 * @returns Nothing.
 */
export async function pushTokenRefreshAlert(message: string): Promise<void> {
  const channel = process.env.SLACK_ALERT_CHANNEL_ID;
  if (!channel) {
    console.error(
      "SLACK_ALERT_CHANNEL_ID not set — cannot send Slack alert. Message was:",
      message,
    );
    return;
  }
  try {
    await getClient().chat.postMessage({ channel, text: message, mrkdwn: true });
  } catch (e) {
    console.error("Failed to post Slack alert:", e instanceof Error ? e.message : String(e));
  }
}
