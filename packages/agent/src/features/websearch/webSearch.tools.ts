import { and, eq } from "drizzle-orm";

import { db } from "../../db/db.js";
import { webSearchCache } from "../../db/schema.js";
import { env } from "../../shared/env.js";
import { err, ok } from "../../shared/errors.js";
import type { Result } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";

import { TavilySearchResponseSchema } from "./webSearch.schema.js";

const TAVILY_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 5;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCache(symbol: string): string | undefined {
  const row = db
    .select({ content: webSearchCache.content })
    .from(webSearchCache)
    .where(and(eq(webSearchCache.symbol, symbol), eq(webSearchCache.date, today())))
    .get();
  return row?.content;
}

function writeCache(symbol: string, content: string): void {
  db.insert(webSearchCache)
    .values({ symbol, date: today(), content, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: [webSearchCache.symbol, webSearchCache.date],
      set: { content, updatedAt: new Date().toISOString() },
    })
    .run();
}

function formatResults(response: {
  results: { title: string; url: string; content: string }[];
}): string {
  if (response.results.length === 0) return "No web search results found.";
  return response.results.map((r) => `- ${r.title} (${r.url})\n  ${r.content}`).join("\n");
}

/**
 * Search the web for current news/sentiment on a stock, via Tavily. Results are
 * cached per symbol per calendar day, so repeated mentions of the same stock in a
 * session don't re-spend search credits — one search per symbol per day regardless
 * of how many times (or in what phrasing) it's asked about.
 * Returns a friendly unavailable message (never throws) when TAVILY_API_KEY is unset,
 * so a missing key degrades the advisor gracefully instead of breaking it.
 * @param symbol - The trading symbol the search is about, used as the cache key
 * @param query - The search query text (composed by the calling LLM)
 * @returns A Result with a formatted text block of search results, or an Error
 */
export async function searchWeb(symbol: string, query: string): Promise<Result<string, Error>> {
  const cached = readCache(symbol);
  if (cached !== undefined) {
    logger.debug("searchWeb: cache hit", { symbol });
    return ok(cached);
  }

  if (!env.TAVILY_API_KEY) {
    return ok(
      "Web search is not configured — answer using available portfolio/technical context only.",
    );
  }

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: MAX_RESULTS,
      }),
    });

    if (!response.ok) {
      return err(new Error(`Tavily request failed: ${response.statusText}`));
    }

    const body: unknown = await response.json();
    const parsed = TavilySearchResponseSchema.safeParse(body);
    if (!parsed.success) {
      return err(new Error(`Tavily response parse error: ${parsed.error.message}`));
    }

    const formatted = formatResults(parsed.data);
    writeCache(symbol, formatted);
    return ok(formatted);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(new Error(`Failed to search web: ${message}`));
  }
}
