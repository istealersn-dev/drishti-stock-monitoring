import { z } from "zod";

import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";

export type TokenExchangeResult =
  { success: true; accessToken: string } | { success: false; errorMessage: string };

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const ErrorResponseSchema = z.object({
  message: z.string(),
});

const FETCH_TIMEOUT_MS = 15000;

/**
 * Exchanges an OAuth authorization code for an Upstox access token.
 * @param code - The `code` captured from the redirect_uri request.
 * @returns A TokenExchangeResult describing success or failure. Can still reject for
 *   causes outside the exchange itself (a Keychain credential read failure, or a network
 *   error before any response is received) — callers must not assume this never throws.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const apiKey = await getCredential(CREDENTIAL_KEYS.apiKey);
  const apiSecret = await getCredential(CREDENTIAL_KEYS.apiSecret);
  const redirectUri = await getCredential(CREDENTIAL_KEYS.redirectUri);

  const body = new URLSearchParams({
    code,
    client_id: apiKey,
    client_secret: apiSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const rawText = await response.text();
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    return {
      success: false,
      errorMessage: `HTTP ${response.status}: non-JSON response: ${rawText.slice(0, 300)}`,
    };
  }

  const tokenParsed = TokenResponseSchema.safeParse(rawJson);
  if (!response.ok || !tokenParsed.success) {
    const errorParsed = ErrorResponseSchema.safeParse(rawJson);
    const errorMessage = errorParsed.success
      ? errorParsed.data.message
      : JSON.stringify(rawJson).slice(0, 300);
    return { success: false, errorMessage: `HTTP ${response.status}: ${errorMessage}` };
  }
  return { success: true, accessToken: tokenParsed.data.access_token };
}

/**
 * Redacts a secret/token for logging, revealing only its length — never any characters,
 * since a "first N / last N" style mask can fully reconstruct a short value.
 * @param value - The secret to redact.
 * @returns A placeholder string containing only the length.
 */
export function safeLengthOnly(value: string): string {
  return `<redacted, length=${value.length}>`;
}
