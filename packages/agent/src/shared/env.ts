import { config } from "dotenv";
import { z } from "zod";

config({ path: new URL("../../../../.env", import.meta.url).pathname });
config({
  path: new URL("../../../../.env.local", import.meta.url).pathname,
  override: true,
});

const EnvironmentSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),

  // LM Studio — kept for backward compatibility but no longer used for advisor/insights
  LM_STUDIO_BASE_URL: z.string().url().optional().default("http://localhost:1234"),
  LM_MODEL: z.string().min(1).optional().default("google/gemma-4-12b-qat"),

  UPSTOX_API_KEY: z.string().min(1),
  UPSTOX_API_SECRET: z.string().min(1),
  UPSTOX_EXTENDED_TOKEN: z.string().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().url(),
  UPSTOX_NOTIFIER_WEBHOOK: z.string().url(),

  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-"),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_ALERT_CHANNEL_ID: z.string().startsWith("C"),
  SLACK_COMMAND_CHANNEL_ID: z.string().startsWith("C"),

  DRISHTI_DRY_RUN: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  DRISHTI_POLL_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  DRISHTI_MARKET_OPEN: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("09:15"),
  DRISHTI_MARKET_CLOSE: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("15:30"),
  DRISHTI_APPROVAL_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  DRISHTI_LLM_MOVE_THRESHOLD_PCT: z.coerce.number().min(0).default(4),

  AGENT_API_PORT: z.coerce.number().int().default(4000),
  DRISHTI_ACCESS_KEY: z.string().min(16),
});

type Environment = z.infer<typeof EnvironmentSchema>;

function loadEnvironment(): Environment {
  const result = EnvironmentSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((index) => `  ${index.path.join(".")}: ${index.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env = loadEnvironment();
