import { z } from "zod";

export const WatchlistEntrySchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  notes: z.string().nullable(),
  addedAt: z.string(),
});
export type WatchlistEntry = z.infer<typeof WatchlistEntrySchema>;

export const ProximityAlertSchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  ltp: z.number(),
  dma200: z.number(),
  distancePct: z.number(),
});
export type ProximityAlert = z.infer<typeof ProximityAlertSchema>;
