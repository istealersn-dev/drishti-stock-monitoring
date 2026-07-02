import * as OTPAuth from "otpauth";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";

export async function generateTotpCode(): Promise<string> {
  const secret = await getCredential(CREDENTIAL_KEYS.totpSecret);
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

export function secondsRemainingInWindow(periodSeconds = 30): number {
  return periodSeconds - (Math.floor(Date.now() / 1000) % periodSeconds);
}
