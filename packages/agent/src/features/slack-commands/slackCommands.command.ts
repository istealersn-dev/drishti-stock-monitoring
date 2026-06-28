const STATUS_PATTERN = /^!status\s*$/i;
const PNL_PATTERN = /^!pnl\s*$/i;
const HOLDINGS_PATTERN = /^!holdings\s*$/i;
const GTTS_PATTERN = /^!gtts\s*$/i;
const ANALYSE_PATTERN = /^!analyse\s+(.+)$/i;

/**
 * Parse a raw message text and return the matched command type and optional query.
 * @param text - Raw Slack message text
 * @returns Matched command or null if no command matched
 */
export function routeCommand(
  text: string,
): { command: "status" | "pnl" | "holdings" | "gtts" | "analyse"; query?: string } | null {
  if (STATUS_PATTERN.test(text)) return { command: "status" };
  if (PNL_PATTERN.test(text)) return { command: "pnl" };
  if (HOLDINGS_PATTERN.test(text)) return { command: "holdings" };
  if (GTTS_PATTERN.test(text)) return { command: "gtts" };

  const analyseMatch = ANALYSE_PATTERN.exec(text);
  if (analyseMatch != null && analyseMatch[1] != null) {
    const query = analyseMatch[1].trim();
    if (query.length > 0) return { command: "analyse", query };
  }

  return null;
}
