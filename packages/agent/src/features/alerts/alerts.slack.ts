import { WebClient } from "@slack/web-api";

import { env } from "../../shared/env.js";
import { SlackError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";

let _client: WebClient | undefined;

function getClient(): WebClient {
  if (!_client) {
    _client = new WebClient(env.SLACK_BOT_TOKEN);
  }
  return _client;
}

/**
 * Post a plain-text alert message to the configured Slack alert channel.
 * @param message - The text to post
 * @returns A Result containing the message timestamp or a SlackError
 */
export async function pushAlert(message: string): Promise<Result<string, SlackError>> {
  try {
    const response = await getClient().chat.postMessage({
      channel: env.SLACK_ALERT_CHANNEL_ID,
      text: message,
      mrkdwn: true,
    });
    if (!response.ok) {
      return err(new SlackError(`Slack API error: ${response.error ?? "unknown"}`));
    }
    return ok(response.ts ?? "");
  } catch (e) {
    const message2 = e instanceof Error ? e.message : String(e);
    return err(new SlackError(`Failed to post Slack message: ${message2}`));
  }
}
