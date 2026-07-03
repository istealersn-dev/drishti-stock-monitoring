import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";

import { env } from "../shared/env.js";
import { LlmError } from "../shared/errors.js";

const DEFAULT_MAX_TOKENS = 2048;
const LLM_TIMEOUT_MS = 120_000;
const DEFAULT_TEMPERATURE = 0.1;

// Portfolio analysis runs 12 holdings in one prompt — ~20s per holding on Gemma 4 12B.
// Token budget and timeout are both elevated to accommodate reasoning overhead.
export const PORTFOLIO_MAX_TOKENS = 8192;
export const PORTFOLIO_LLM_TIMEOUT_MS = 300_000;

// Single-turn advisor calls (chat history + portfolio context, or technical-levels
// reasoning) run heavier prompts than the default case but lighter than a full
// 12-holding portfolio batch — the 120s default is too tight for Gemma 4 12B here.
export const ADVISOR_LLM_TIMEOUT_MS = 180_000;
export const ADVISOR_MAX_TOKENS = 1500; // keeps the persona's "under 1000 characters" rule enforceable
export const ADVISOR_TEMPERATURE = 0.7; // conversational persona — higher variance than structured-output calls
// Trade setup JSON (entry/SL/targets + a free-text rationale) needs more headroom
// than the terse persona reply, but not the full portfolio-analysis budget.
export const TRADE_SETUP_MAX_TOKENS = 4096;

// Lightweight fuzzy-match fallback (returns a single ~20-token symbol guess) — fails
// fast rather than inheriting the 120s default sized for much heavier prompts.
export const SYMBOL_RESOLVE_TIMEOUT_MS = 30_000;

const client = new OpenAI({
  baseURL: env.LM_STUDIO_BASE_URL + "/v1",
  apiKey: "lm-studio",
  timeout: LLM_TIMEOUT_MS,
  maxRetries: 0,
});

/**
 * Send a chat completion request to LM Studio.
 * @param messages - The conversation messages
 * @param maxTokens - Max completion tokens; defaults to 2048, use PORTFOLIO_MAX_TOKENS for multi-holding analysis
 * @param timeoutMs - Request timeout; defaults to 120s, use PORTFOLIO_LLM_TIMEOUT_MS or ADVISOR_LLM_TIMEOUT_MS for heavier prompts
 * @param temperature - Sampling temperature; defaults to 0.1 (deterministic). Use a higher value for conversational/persona replies
 * @returns The assistant's text response
 */
export async function chat(
  messages: ChatCompletionMessageParam[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  timeoutMs: number = LLM_TIMEOUT_MS,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<string> {
  const response = await client.chat.completions.create(
    {
      model: env.LM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    },
    { timeout: timeoutMs },
  );

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new LlmError("LM Studio returned an empty response");
  }
  return content.trim();
}

/**
 * Send a single-turn chat completion (system prompt + one user message) to LM Studio.
 * Convenience wrapper over chat() for the common one-shot case with no conversation history.
 * @param systemPrompt - System prompt for the task
 * @param userContent - The user/data prompt
 * @param options.maxTokens - Max completion tokens; defaults to 2048
 * @param options.timeoutMs - Request timeout; defaults to 120s
 * @param options.temperature - Sampling temperature; defaults to 0.1
 * @returns The assistant's text response
 */
export async function chatOnce(
  systemPrompt: string,
  userContent: string,
  options: { maxTokens?: number; timeoutMs?: number; temperature?: number } = {},
): Promise<string> {
  return chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    options.maxTokens,
    options.timeoutMs,
    options.temperature,
  );
}

/**
 * Send a chat completion request with tool definitions to LM Studio.
 * @param messages - The conversation messages
 * @param tools - Tool definitions for the model to call
 * @param maxTokens - Max completion tokens; defaults to 2048
 * @param timeoutMs - Request timeout; defaults to 120s
 * @param temperature - Sampling temperature; defaults to 0.1
 * @returns The full choice object including any tool calls
 */
export async function chatWithTools(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  timeoutMs: number = LLM_TIMEOUT_MS,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
  const response = await client.chat.completions.create(
    {
      model: env.LM_MODEL,
      messages,
      tools,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    },
    { timeout: timeoutMs },
  );

  const message = response.choices[0]?.message;
  if (message == null) {
    throw new LlmError("LM Studio returned an empty response");
  }
  return message;
}
