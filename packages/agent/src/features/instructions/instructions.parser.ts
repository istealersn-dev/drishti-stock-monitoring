import { randomUUID } from "node:crypto";

import { z } from "zod";

import { db } from "../../db/db.js";
import { agentLogs } from "../../db/schema.js";
import { chat } from "../../llm/llmClient.js";
import { env } from "../../shared/env.js";
import { LlmError, err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { stripJsonCodeFence } from "../../shared/llmResponse.js";
import { logger } from "../../shared/logger.js";

import { ParsedInstructionSchema } from "./instructions.schema.js";
import type { ParsedInstruction } from "./instructions.schema.js";

const RawActionSchema = z.object({ action: z.unknown().optional() });

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

export type ParsedInstructionWithDisagreement = {
  instruction: ParsedInstruction;
  /**
   * Non-null when the model's own action extraction disagreed with the forced
   * "BUY" (e.g. it extracted "SELL"/"EXIT"), which can mean the intent
   * classifier upstream misrouted a sell/exit instruction as ORDER. Surfaced on
   * the approval card so a human sees the anomaly at decision time, not just in
   * agent_logs after the fact.
   */
  actionDisagreement: string | null;
};

/**
 * Parse a natural-language buy instruction using the local LLM.
 * @param text - Raw instruction text (e.g. "Ramco Systems Buy 560-580 SL 520 Tgt 680 800+")
 * @returns A Result containing the parsed instruction (plus any action-field
 *   disagreement) or an LlmError
 */
export async function parseInstruction(
  text: string,
): Promise<Result<ParsedInstructionWithDisagreement, LlmError>> {
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

    // Force action to "BUY" regardless of what the model returned for this field.
    // parseInstruction is only ever invoked after the intent classifier has already
    // determined the message is a buy order (see instructions.intent.ts / CLAUDE.md's
    // "SELL is handled autonomously via SL" — this parser never handles SELL), so
    // requiring the model to also echo back the literal string "BUY" is redundant
    // and fails whenever the input doesn't literally contain the word "buy" (e.g.
    // "Goldbees 120-123 SL 110 Tgt 140-170", which the classifier still correctly
    // routed as an order given the price-level format).
    //
    // Forcing this field silently removes a diagnostic signal that used to exist:
    // this parser's own model call previously had to agree the instruction was a
    // buy. If it now disagrees (e.g. the model extracted "SELL"/"EXIT" — a sign the
    // classifier upstream may have misrouted a sell/exit instruction as ORDER), log
    // it instead of silently overriding, so a misrouted instruction is still visible
    // rather than quietly turning into a buy approval card.
    const rawActionResult = RawActionSchema.safeParse(raw);
    const rawAction = rawActionResult.success ? rawActionResult.data.action : undefined;
    let actionDisagreement: string | null = null;
    if (rawAction != null && rawAction !== "BUY") {
      actionDisagreement = String(rawAction);
      logger.warn("parseInstruction: model disagreed with forced action=BUY", {
        text: text.slice(0, 100),
        modelAction: rawAction,
      });
      db.insert(agentLogs)
        .values({
          runId: randomUUID(),
          symbol: null,
          action: "buy_action_field_overridden",
          reasoning: null,
          dryRun: env.DRISHTI_DRY_RUN,
          error: `Model returned action=${JSON.stringify(rawAction)} for text: ${text.slice(0, 100)}`,
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    const withForcedAction = {
      ...(typeof raw === "object" && raw !== null ? raw : {}),
      action: "BUY",
    };

    const parsed = ParsedInstructionSchema.safeParse(withForcedAction);
    if (!parsed.success) {
      return err(new LlmError(`LLM response failed schema validation: ${parsed.error.message}`));
    }

    return ok({ instruction: parsed.data, actionDisagreement });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(new LlmError(`Failed to parse instruction: ${message}`));
  }
}
