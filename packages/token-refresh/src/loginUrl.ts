import { CREDENTIAL_KEYS } from "./credentials.js";
import { getCredential } from "./keychain.js";

/**
 * Builds Upstox's OAuth authorization-dialog URL from Keychain-stored credentials.
 * @returns The full login dialog URL.
 */
export async function buildLoginDialogUrl(): Promise<string> {
  const apiKey = await getCredential(CREDENTIAL_KEYS.apiKey);
  const redirectUri = await getCredential(CREDENTIAL_KEYS.redirectUri);
  const url = new URL("https://api.upstox.com/v2/login/authorization/dialog");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}
