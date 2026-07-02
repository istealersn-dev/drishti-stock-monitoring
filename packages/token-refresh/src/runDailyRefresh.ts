import { writeToken } from "./envWriter.js";
import { LoginFlowError, runLoginFlow } from "./loginFlow.js";
import { pushTokenRefreshAlert } from "./slackNotify.js";
import { exchangeCodeForToken, safeLengthOnly } from "./tokenExchange.js";

const ENV_LOCAL_PATH = new URL("../../../.env.local", import.meta.url).pathname;
const OTP_COOLDOWN_MS = 11 * 60 * 1000; // Upstox's cooldown is ~10 min; pad by 1 for clock skew.

function describeLoginError(e: unknown): string {
  return e instanceof LoginFlowError ? `[${e.stage}] ${e.message}` : String(e);
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
      await new Promise((r) => setTimeout(r, OTP_COOLDOWN_MS));
      return await runLoginFlow(); // single retry only — never loop
    }
    throw e;
  }
}

async function main(): Promise<void> {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] starting Upstox token refresh`);

  let code: string;
  try {
    code = await attemptLogin();
  } catch (e) {
    const message = describeLoginError(e);
    console.error(`login flow failed: ${message}`);
    await pushTokenRefreshAlert(`:x: Drishti Upstox token refresh FAILED at login: ${message}`);
    process.exit(1);
  }

  const exchangeResult = await exchangeCodeForToken(code);
  if (!exchangeResult.success) {
    console.error(`token exchange failed: ${exchangeResult.errorMessage}`);
    await pushTokenRefreshAlert(
      `:x: Drishti Upstox token refresh FAILED at token exchange: ${exchangeResult.errorMessage}`,
    );
    process.exit(1);
  }

  const refreshedAt = new Date();
  await writeToken(ENV_LOCAL_PATH, exchangeResult.accessToken, refreshedAt);
  console.log(`wrote access_token (${safeLengthOnly(exchangeResult.accessToken)}) to .env.local`);

  await pushTokenRefreshAlert(
    `:white_check_mark: Drishti Upstox token refresh succeeded at ${refreshedAt.toISOString()}`,
  );
  console.log("done.");
}

await main();
