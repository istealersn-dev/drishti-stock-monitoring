import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";

export type TokenExchangeResult =
  { success: true; accessToken: string } | { success: false; errorMessage: string };

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
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof json.access_token !== "string") {
    const errorMessage =
      typeof json.message === "string" ? json.message : JSON.stringify(json).slice(0, 300);
    return { success: false, errorMessage: `HTTP ${response.status}: ${errorMessage}` };
  }
  return { success: true, accessToken: json.access_token };
}

// Only ever reveals length, never characters — a short code/token can be fully
// reconstructed from a "first N / last N" mask, which defeats the point of masking.
export function safeLengthOnly(value: string): string {
  return `<redacted, length=${value.length}>`;
}
