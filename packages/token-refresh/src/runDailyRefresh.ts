import { writeToken } from "./envWriter.js";
import { LoginFlowError, runLoginFlow } from "./loginFlow.js";
import { pushTokenRefreshAlert } from "./slackNotify.js";
import { exchangeCodeForToken, safeLengthOnly } from "./tokenExchange.js";

const ENV_LOCAL_PATH = new URL("../../../.env.local", import.meta.url).pathname;
const OTP_COOLDOWN_MS = 11 * 60 * 1000; // Upstox's cooldown is ~10 min; pad by 1 for clock skew.

function describeError(e: unknown): string {
  return e instanceof LoginFlowError
    ? `[${e.stage}] ${e.message}`
    : e instanceof Error
      ? e.message
      : String(e);
}

async function attemptLogin(): Promise<string> {
  try {
    return await runLoginFlow();
  } catch (e) {
    if (e instanceof LoginFlowError && e.isOtpRateLimited) {
      console.log(
        `OTP generation rate-limited — waiting ${OTP_COOLDOWN_MS / 60_000} min before one retry.`,
      );
      await pushTokenRefreshAlert(
        `:hourglass_flowing_sand: Drishti Upstox token refresh hit the OTP rate limit — retrying in ${OTP_COOLDOWN_MS / 60_000} min.`,
      );
      await new Promise((resolve) => setTimeout(resolve, OTP_COOLDOWN_MS));
      return await runLoginFlow(); // single retry only — never loop
    }
    throw e;
  }
}

async function refreshToken(): Promise<void> {
  const code = await attemptLogin();

  const exchangeResult = await exchangeCodeForToken(code);
  if (!exchangeResult.success) {
    throw new Error(`token exchange failed: ${exchangeResult.errorMessage}`);
  }

  const refreshedAt = new Date();
  await writeToken(ENV_LOCAL_PATH, exchangeResult.accessToken, refreshedAt);
  console.log(`wrote access_token (${safeLengthOnly(exchangeResult.accessToken)}) to .env.local`);

  await pushTokenRefreshAlert(
    `:white_check_mark: Drishti Upstox token refresh succeeded at ${refreshedAt.toISOString()}`,
  );
}

async function main(): Promise<void> {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] starting Upstox token refresh`);

  // Every stage of the pipeline (login, token exchange, .env.local write) is covered by
  // this single boundary, so a failure anywhere always reaches the Slack alert below —
  // no stage can fail silently.
  try {
    await refreshToken();
    console.log("done.");
  } catch (e) {
    const message = describeError(e);
    console.error(`token refresh failed: ${message}`);
    await pushTokenRefreshAlert(`:x: Drishti Upstox token refresh FAILED: ${message}`);
    process.exit(1);
  }
}

await main();
