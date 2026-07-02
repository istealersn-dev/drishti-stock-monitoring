export const CREDENTIAL_KEYS = {
  username: "drishti-upstox-username",
  pin: "drishti-upstox-pin",
  totpSecret: "drishti-upstox-totp-secret",
  apiKey: "drishti-upstox-api-key",
  apiSecret: "drishti-upstox-api-secret",
  redirectUri: "drishti-upstox-redirect-uri",
} as const;

export type CredentialField = keyof typeof CREDENTIAL_KEYS;

export const ALL_CREDENTIAL_KEYS: string[] = Object.values(CREDENTIAL_KEYS);
