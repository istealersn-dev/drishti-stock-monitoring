import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPostMessage, MockWebClient } = vi.hoisted(() => {
  const postMessage = vi.fn();
  return {
    mockPostMessage: postMessage,
    MockWebClient: vi.fn().mockImplementation(() => ({ chat: { postMessage } })),
  };
});

vi.mock("dotenv", () => ({ config: vi.fn() }));
vi.mock("@slack/web-api", () => ({ WebClient: MockWebClient }));

describe("pushTokenRefreshAlert", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockPostMessage.mockReset().mockResolvedValue({ ok: true });
    process.env = { ...originalEnv, SLACK_BOT_TOKEN: "test-token", SLACK_ALERT_CHANNEL_ID: "C123" };
  });

  it("posts the given message to the configured alert channel", async () => {
    const { pushTokenRefreshAlert } = await import("./slackNotify.js");
    await pushTokenRefreshAlert("test message");
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C123", text: "test message" })
    );
  });

  it("does not throw and does not call Slack when the channel id is missing", async () => {
    process.env.SLACK_ALERT_CHANNEL_ID = "";
    const { pushTokenRefreshAlert } = await import("./slackNotify.js");
    await expect(pushTokenRefreshAlert("test message")).resolves.toBeUndefined();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("swallows a Slack API failure instead of throwing (alerting must never crash the refresh script)", async () => {
    mockPostMessage.mockRejectedValue(new Error("slack down"));
    const { pushTokenRefreshAlert } = await import("./slackNotify.js");
    await expect(pushTokenRefreshAlert("test message")).resolves.toBeUndefined();
  });
});
