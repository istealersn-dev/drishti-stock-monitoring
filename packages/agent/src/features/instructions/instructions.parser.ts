import { chat } from "../../llm/llmClient.js";
import { LlmError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { stripJsonCodeFence } from "../../shared/llmResponse.js";

import { ParsedInstructionSchema } from "./instructions.schema.js";
import type { ParsedInstruction } from "./instructions.schema.js";

const SYSTEM_PROMPT = `You are a financial instruction parser. Extract structured data from a natural-language stock instruction. Output valid JSON only. No markdown.

Input examples:
  "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+"
  "Buy HDFCBANK 1600-1650 sl 1550 target 1800"
  "TATAMOTORS buy 780 SL 740 tgt 850 900+"

Output schema:
{
  "stockName": "string",
  "action": "BUY",
  "entryLow": number,
  "entryHigh": number,
  "stopLoss": number,
  "targets": [
    { "price": number, "isOpenEnded": boolean }
  ]
}

If entryLow === entryHigh (single price given), set both to that price.
If any required field is missing, set it to null.`;

/**
 * Parse a natural-language buy instruction using the local LLM.
 * @param text - Raw instruction text (e.g. "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+")
 * @returns A Result containing the parsed instruction or an LlmError
 */
export async function parseInstruction(text: string): Promise<Result<ParsedInstruction, LlmError>> {
  try {
    const response = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ]);

    const cleaned = stripJsonCodeFence(response);

    let raw: unknown;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      return err(new LlmError(`LLM returned non-JSON: ${cleaned.slice(0, 120)}`));
    }

    const parsed = ParsedInstructionSchema.safeParse(raw);
    if (!parsed.success) {
      return err(new LlmError(`LLM response failed schema validation: ${parsed.error.message}`));
    }

    return ok(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new LlmError(`Failed to parse instruction: ${message}`));
  }
}
