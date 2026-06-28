import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";

import { env } from "../shared/env.js";
import { LlmError } from "../shared/errors.js";

const MAX_CONTEXT_TOKENS = 2048;

const LLM_TIMEOUT_MS = 120_000;

const client = new OpenAI({
  baseURL: env.LM_STUDIO_BASE_URL + "/v1",
  apiKey: "lm-studio",
  timeout: LLM_TIMEOUT_MS,
  maxRetries: 0,
});

// Extends the base params to carry LM Studio / Qwen3 specific fields.
// chat_template_kwargs.thinking = false disables Qwen3's chain-of-thought mode;
// without it the model emits only <think> tokens which LM Studio strips,
// leaving an empty content string.
type LmStudioParams = ChatCompletionCreateParamsNonStreaming & {
  chat_template_kwargs?: { thinking: boolean };
};

function baseParams(): Pick<LmStudioParams, "model" | "max_tokens" | "temperature" | "chat_template_kwargs" | "stream"> {
  return {
    model: env.LM_MODEL,
    max_tokens: MAX_CONTEXT_TOKENS,
    temperature: 0.1,
    stream: false,
    chat_template_kwargs: { thinking: false },
  };
}

/**
 * Send a chat completion request to LM Studio.
 * @param messages - The conversation messages
 * @returns The assistant's text response
 */
export async function chat(messages: ChatCompletionMessageParam[]): Promise<string> {
  const params: LmStudioParams = { ...baseParams(), messages };
  const response = await client.chat.completions.create(params);

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new LlmError("LM Studio returned an empty response");
  }
  return content.trim();
}

/**
 * Send a chat completion request with tool definitions to LM Studio.
 * @param messages - The conversation messages
 * @param tools - Tool definitions for the model to call
 * @returns The full choice object including any tool calls
 */
export async function chatWithTools(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
  const params: LmStudioParams = { ...baseParams(), messages, tools };
  const response = await client.chat.completions.create(params);

  const message = response.choices[0]?.message;
  if (message == null) {
    throw new LlmError("LM Studio returned an empty response");
  }
  return message;
}
