import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockChatWithTools } = vi.hoisted(() => ({ mockChatWithTools: vi.fn() }));

vi.mock("./llmClient.js", () => ({ chatWithTools: mockChatWithTools }));

import { runToolLoop } from "./toolLoop.js";

describe("runToolLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the content directly when the model makes no tool calls", async () => {
    mockChatWithTools.mockResolvedValue({ content: "Final answer.", tool_calls: undefined });

    const result = await runToolLoop([{ role: "user", content: "hi" }], [], {});

    expect(result).toBe("Final answer.");
    expect(mockChatWithTools).toHaveBeenCalledOnce();
  });

  it("executes a tool call, appends the result, and returns the follow-up answer", async () => {
    const executor = vi.fn().mockResolvedValue("search result text");
    mockChatWithTools
      .mockResolvedValueOnce({
        content: null,
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "web_search", arguments: '{"q":"x"}' },
          },
        ],
      })
      .mockResolvedValueOnce({ content: "Answer using search results.", tool_calls: undefined });

    const result = await runToolLoop([{ role: "user", content: "what's new with RELIANCE?" }], [], {
      web_search: executor,
    });

    expect(result).toBe("Answer using search results.");
    expect(executor).toHaveBeenCalledWith('{"q":"x"}');
    expect(mockChatWithTools).toHaveBeenCalledTimes(2);

    const secondCallMessages = mockChatWithTools.mock.calls[1]?.[0] as {
      role: string;
      content?: string;
    }[];
    const toolMessage = secondCallMessages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toBe("search result text");
  });

  it("reports an unknown tool without crashing", async () => {
    mockChatWithTools
      .mockResolvedValueOnce({
        content: null,
        tool_calls: [
          { id: "call-1", type: "function", function: { name: "mystery_tool", arguments: "{}" } },
        ],
      })
      .mockResolvedValueOnce({ content: "Done.", tool_calls: undefined });

    const result = await runToolLoop([{ role: "user", content: "hi" }], [], {});

    expect(result).toBe("Done.");
    const secondCallMessages = mockChatWithTools.mock.calls[1]?.[0] as {
      role: string;
      content?: string;
    }[];
    const toolMessage = secondCallMessages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toContain("Unknown tool");
  });

  it("throws once the max round cap is exceeded by a model that keeps calling tools", async () => {
    mockChatWithTools.mockResolvedValue({
      content: null,
      tool_calls: [
        { id: "call-1", type: "function", function: { name: "web_search", arguments: "{}" } },
      ],
    });

    await expect(
      runToolLoop([{ role: "user", content: "hi" }], [], {
        web_search: vi.fn().mockResolvedValue("result"),
      }),
    ).rejects.toThrow(/exceeded/i);
  });

  it("returns an empty string when the final message has null content", async () => {
    mockChatWithTools.mockResolvedValue({ content: null, tool_calls: undefined });

    const result = await runToolLoop([{ role: "user", content: "hi" }], [], {});

    expect(result).toBe("");
  });
});
