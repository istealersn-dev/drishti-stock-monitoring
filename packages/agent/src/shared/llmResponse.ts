/**
 * Strip a leading/trailing markdown code fence (with or without a "json" language
 * tag) from a raw LLM response, so the remainder can be handed to JSON.parse.
 * @param response - The raw text returned by the model
 * @returns The response with any wrapping code fence removed, trimmed
 */
export function stripJsonCodeFence(response: string): string {
  return response
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}
