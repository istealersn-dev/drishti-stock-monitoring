import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPostMessage = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_ALERT_CHANNEL_ID: "C123456",
  },
}));

import { pushAlert } from "./alerts.slack.js";

describe("pushAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok with ts on success", async () => {
    mockPostMessage.mockResolvedValue({ ok: true, ts: "1234567890.000001" });

    const result = await pushAlert("Test message");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("1234567890.000001");
    }
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Test message", channel: "C123456" }),
    );
  });

  it("returns err when Slack API returns ok: false", async () => {
    mockPostMessage.mockResolvedValue({ ok: false, error: "channel_not_found" });

    const result = await pushAlert("Test message");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("channel_not_found");
    }
  });

  it("returns err when postMessage throws", async () => {
    mockPostMessage.mockRejectedValue(new Error("network error"));

    const result = await pushAlert("Test message");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("network error");
    }
  });
});
