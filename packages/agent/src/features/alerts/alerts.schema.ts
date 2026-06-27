import { z } from "zod";

export const SlackPostResponseSchema = z.object({
  ok: z.boolean(),
  ts: z.string().optional(),
  error: z.string().optional(),
});

export type SlackPostResponse = z.infer<typeof SlackPostResponseSchema>;
