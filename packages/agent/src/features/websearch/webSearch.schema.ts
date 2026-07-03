import { z } from "zod";

export const TavilyResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  content: z.string(),
  score: z.number(),
});

export const TavilySearchResponseSchema = z.object({
  query: z.string(),
  answer: z.string().nullable().optional(),
  results: z.array(TavilyResultSchema),
});
export type TavilySearchResponse = z.infer<typeof TavilySearchResponseSchema>;

export const WebSearchToolArgumentsSchema = z.object({
  symbol: z.string().min(1),
  query: z.string().min(1),
});
export type WebSearchToolArguments = z.infer<typeof WebSearchToolArgumentsSchema>;
