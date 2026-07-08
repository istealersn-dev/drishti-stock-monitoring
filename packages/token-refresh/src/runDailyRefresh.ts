import { writeToken } from "./envWriter.js";
import { LoginFlowError, runLoginFlow } from "./loginFlow.js";
import { restartAgent } from "./pm2Restart.js";
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

  let exchangeResult;
  try {
    exchangeResult = await exchangeCodeForToken(code);
  } catch (e) {
    // exchangeCodeForToken can reject outside its own Result type (a Keychain read
    // failure, a network error, or the fetch timeout) — wrap it the same way a
    // Result-style failure is wrapped below, so every exchange failure reaches Slack
    // with the same "token exchange failed:" context instead of a bare, stage-less message.
    throw new Error(`token exchange failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!exchangeResult.success) {
    throw new Error(`token exchange failed: ${exchangeResult.errorMessage}`);
  }

  const refreshedAt = new Date();
  try {
    await writeToken(ENV_LOCAL_PATH, exchangeResult.accessToken, refreshedAt);
  } catch (e) {
    throw new Error(`writing .env.local failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  console.log(`wrote access_token (${safeLengthOnly(exchangeResult.accessToken)}) to .env.local`);

  // env.ts parses .env.local once at process startup, so the freshly-written token
  // sits unused until the agent restarts. A restart failure here must not mark the
  // whole refresh as failed — the token itself was written successfully, which is
  // the higher-value fact — but it must still reach Slack so a stale-running agent
  // doesn't go unnoticed.
  let restartNote = "";
  try {
    await restartAgent();
    console.log("restarted drishti-agent");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`pm2 restart drishti-agent failed: ${message}`);
    restartNote = `\n:warning: Token written, but \`pm2 restart drishti-agent\` failed (${message}) — restart it manually.`;
  }

  await pushTokenRefreshAlert(
    `:white_check_mark: Drishti Upstox token refresh succeeded at ${refreshedAt.toISOString()}${restartNote}`,
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
