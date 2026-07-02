import * as OTPAuth from "otpauth";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";

const TOTP_PERIOD_SECONDS = 30;

/**
 * Generates the current 6-digit TOTP code from the Keychain-stored secret.
 * @returns The current code.
 */
export async function generateTotpCode(): Promise<string> {
  const secret = await getCredential(CREDENTIAL_KEYS.totpSecret);
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD_SECONDS,
  });
  return totp.generate();
}

/**
 * How many seconds remain in the current TOTP window.
 * @param periodSeconds - The TOTP period; defaults to the standard 30s.
 * @returns Seconds remaining, in (0, periodSeconds].
 */
export function secondsRemainingInWindow(periodSeconds = TOTP_PERIOD_SECONDS): number {
  return periodSeconds - (Math.floor(Date.now() / 1000) % periodSeconds);
}
