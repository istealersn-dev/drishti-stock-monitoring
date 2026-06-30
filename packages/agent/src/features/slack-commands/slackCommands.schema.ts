import { z } from "zod";

/**
 * Zod shape for the fields Drishti reads from a Bolt message event.
 * Used by both the command router and the buy-instruction listener.
 */
export const SlackMessageShape = z.object({
  channel: z.string().optional().default(""),
  text: z.string().optional(),
  thread_ts: z.string().optional(),
});
