import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";

import { env } from "../shared/env.js";
import { LlmError } from "../shared/errors.js";

const GEMINI_FLASH = "gemini-2.5-flash";
const GEMINI_FLASH_LITE = "gemini-2.5-flash-lite-preview-06-17";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Convert SQLite advisory conversation rows to Gemini Content history.
 * SQLite uses role "assistant"; Gemini expects "model".
 * @param rows - Rows from advisoryConversations table
 * @returns Gemini-format conversation history
 */
export function toGeminiHistory(
  rows: Array<{ role: string; content: string }>,
): Content[] {
  return rows.map((r) => ({
    role: r.role === "assistant" ? "model" : "user",
    parts: [{ text: r.content }],
  }));
}

/**
 * Send a message to Drishti (multi-turn chat). Google Search grounding is opt-in —
 * pass opts.grounding only when the question actually needs live web data, since
 * grounding carries its own cost/quota on top of normal token usage.
 * The caller is responsible for loading and passing conversation history.
 * @param systemInstruction - The full Drishti system prompt
 * @param history - Prior turns as Gemini Content array
 * @param message - The new user message
 * @param options.grounding - Enable Google Search grounding for this turn; defaults to false
 * @returns Drishti's response text
 */
export async function chatWithDrishti(
  systemInstruction: string,
  history: Content[],
  message: string,
  options: { grounding?: boolean } = {},
): Promise<string> {
  const chatSession = ai.chats.create({
    model: GEMINI_FLASH,
    history,
    config: {
      systemInstruction,
      ...(options.grounding ? { tools: [{ googleSearch: {} }] } : {}),
      temperature: 0.7,
      maxOutputTokens: 1500,
    },
  });

  const response = await chatSession.sendMessage({ message });
  // Filter out thought parts — 2.5 Flash includes reasoning traces in response.text
  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new LlmError("Gemini returned an empty response");
  }
  return text;
}

/**
 * One-shot text generation without conversation history or search grounding.
 * Used for structured outputs (portfolio analysis, trade setup, digest).
 * Defaults to the lite model for cost efficiency on high-frequency calls.
 * @param systemInstruction - System prompt for the task
 * @param userPrompt - The user/data prompt
 * @param opts.model - Override model; defaults to flash-lite
 * @param opts.maxTokens - Max output tokens; defaults to 2048
 * @returns Generated text
 */
export async function generateText(
  systemInstruction: string,
  userPrompt: string,
  opts: { model?: string; maxTokens?: number } = {},
): Promise<string> {
  const model = opts.model ?? GEMINI_FLASH_LITE;
  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.1,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  });

  const text = response.text;
  if (!text?.trim()) {
    throw new LlmError("Gemini returned an empty response");
  }
  return text.trim();
}
