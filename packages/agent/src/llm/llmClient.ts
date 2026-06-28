import OpenAI from "openai";
import type {
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

/**
 * Send a chat completion request to LM Studio.
 * @param messages - The conversation messages
 * @returns The assistant's text response
 */
export async function chat(messages: ChatCompletionMessageParam[]): Promise<string> {
  const response = await client.chat.completions.create({
    model: env.LM_MODEL,
    messages,
    max_tokens: MAX_CONTEXT_TOKENS,
    temperature: 0.1,
    stream: false,
  });

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
  const response = await client.chat.completions.create({
    model: env.LM_MODEL,
    messages,
    tools,
    max_tokens: MAX_CONTEXT_TOKENS,
    temperature: 0.1,
    stream: false,
  });

  const message = response.choices[0]?.message;
  if (message == null) {
    throw new LlmError("LM Studio returned an empty response");
  }
  return message;
}
