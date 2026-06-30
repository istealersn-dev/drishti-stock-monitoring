import { z } from "zod";

export const ValidationResultSchema = z.discriminatedUnion("pass", [
  z.object({ pass: z.literal(true) }),
  z.object({ pass: z.literal(false), reason: z.string() }),
]);

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
