import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

vi.mock("../shared/env.js", () => ({
  env: { LM_STUDIO_BASE_URL: "http://localhost:1234", LM_MODEL: "test-model" },
}));

import { chat, chatWithTools } from "./llmClient.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("chat", () => {
  it("uses the SDK client by default", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "hello" } }] });

    const result = await chat([{ role: "user", content: "hi" }]);

    expect(result).toBe("hello");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("bypasses the SDK and disables reasoning via a raw fetch when reasoningEffort is 'none'", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "fast answer" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await chat([{ role: "user", content: "hi" }], 200, 5000, 0.1, "none");

    expect(result).toBe("fast answer");
    expect(mockCreate).not.toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.reasoning_effort).toBe("none");
  });

  it("throws when the raw-fetch reasoning-disabled path returns empty content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: {} }] }) }),
    );

    await expect(chat([{ role: "user", content: "hi" }], 200, 5000, 0.1, "none")).rejects.toThrow(
      "LM Studio returned an empty response",
    );
  });
});

describe("chatWithTools", () => {
  it("returns tool_calls from the reasoning-disabled raw-fetch path", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "web_search", arguments: "{}" },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const message = await chatWithTools(
      [{ role: "user", content: "hi" }],
      [{ type: "function", function: { name: "web_search", parameters: {} } }],
      200,
      5000,
      0.1,
      "none",
    );

    expect(message.tool_calls).toHaveLength(1);
    expect(message.tool_calls?.[0]?.function.name).toBe("web_search");
    expect(mockCreate).not.toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.tools).toBeDefined();
  });
});
