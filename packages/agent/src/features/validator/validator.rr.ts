import type { ParsedInstruction } from "../instructions/instructions.schema.js";

import type { ValidationResult } from "./validator.schema.js";

const MIN_RISK_REWARD_RATIO = 2.0;

/**
 * Validate that a buy instruction meets the minimum risk-to-reward ratio (1:2).
 * Uses the entry midpoint, the stop-loss, and the first target (T1) to compute
 * risk and reward.
 * @param instruction - The parsed buy instruction to validate
 * @returns A pass result, or a fail result with a human-readable reason
 */
export function validateRiskReward(instruction: ParsedInstruction): ValidationResult {
  const { entryLow, entryHigh, stopLoss, targets } = instruction;

  const low = entryLow ?? entryHigh;
  const high = entryHigh ?? entryLow;
  if (low === null || high === null) {
    return { pass: false, reason: "No entry price specified." };
  }
  const entry = (low + high) / 2;

  if (stopLoss === null) {
    return { pass: false, reason: "No stop-loss specified." };
  }

  const risk = entry - stopLoss;
  if (risk <= 0) {
    return { pass: false, reason: "Stop-loss must be below entry price." };
  }

  const t1 = targets[0];
  if (t1 === undefined) {
    return { pass: false, reason: "No T1 target specified." };
  }

  const reward = t1.price - entry;
  const ratio = reward / risk;
  if (ratio < MIN_RISK_REWARD_RATIO) {
    const minT1 = (entry + risk * 2).toFixed(0);
    return {
      pass: false,
      reason:
        `R:R is 1:${ratio.toFixed(1)} (minimum 1:2)\n` +
        `• Entry ₹${entry.toFixed(0)}  •  SL ₹${stopLoss.toFixed(0)} (risk ₹${risk.toFixed(0)})\n` +
        `• T1 ₹${t1.price.toFixed(0)}  •  Reward ₹${reward.toFixed(0)}\n` +
        `Raise T1 to ₹${minT1}+ or tighten SL to clear 1:2.`,
    };
  }

  return { pass: true };
}
