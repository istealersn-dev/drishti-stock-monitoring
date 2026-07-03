import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";

import { LlmError } from "../shared/errors.js";

import { chatWithTools } from "./llmClient.js";

const MAX_TOOL_ROUNDS = 3;

export type ToolExecutor = (argumentsJson: string) => Promise<string>;

/**
 * Run a chat completion through LM Studio, executing any tool calls the model makes
 * and feeding results back until it returns a final text answer (or the round cap is
 * hit, guarding against a model that keeps calling tools indefinitely).
 * @param messages - The conversation messages
 * @param tools - Tool definitions available to the model
 * @param executors - Map of tool name to a function that executes it and returns a
 *   string result, given the model's raw JSON arguments string
 * @param options.maxTokens - Max completion tokens per round
 * @param options.timeoutMs - Request timeout per round
 * @param options.temperature - Sampling temperature per round
 * @param options.reasoningEffort - Pass "none" to disable the model's thinking phase
 *   each round — use for low-token-budget loops where reasoning could otherwise
 *   consume the whole per-round budget before any content/tool call is emitted
 * @returns The model's final text answer
 */
export async function runToolLoop(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  executors: Record<string, ToolExecutor>,
  options: {
    maxTokens?: number;
    timeoutMs?: number;
    temperature?: number;
    reasoningEffort?: "none";
  } = {},
): Promise<string> {
  const conversation = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const message = await chatWithTools(
      conversation,
      tools,
      options.maxTokens,
      options.timeoutMs,
      options.temperature,
      options.reasoningEffort,
    );

    if (!message.tool_calls || message.tool_calls.length === 0) {
      const content = message.content?.trim();
      if (!content) {
        throw new LlmError("LM Studio returned an empty final answer");
      }
      return content;
    }

    conversation.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: message.tool_calls,
    });

    for (const call of message.tool_calls) {
      const executor = executors[call.function.name];
      const result = executor
        ? await executor(call.function.arguments)
        : `Unknown tool: ${call.function.name}`;
      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  throw new LlmError(`Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds without a final answer`);
}
