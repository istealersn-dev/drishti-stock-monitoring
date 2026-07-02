import { ALL_CREDENTIAL_KEYS, CREDENTIAL_KEYS, type CredentialField } from "./credentials.js";
import { listConfiguredKeys, setCredential } from "./keychain.js";
import { promptMasked, promptPlain } from "./prompt.js";

type FieldSpec = {
  name: CredentialField;
  key: string;
  label: string;
  masked: boolean;
};

const FIELDS: FieldSpec[] = [
  { name: "username", key: CREDENTIAL_KEYS.username, label: "Mobile number: ", masked: false },
  {
    name: "totpSecret",
    key: CREDENTIAL_KEYS.totpSecret,
    label: "TOTP secret (base32): ",
    masked: true,
  },
  { name: "pin", key: CREDENTIAL_KEYS.pin, label: "Login PIN: ", masked: true },
  { name: "apiKey", key: CREDENTIAL_KEYS.apiKey, label: "API Key (client id): ", masked: false },
  {
    name: "apiSecret",
    key: CREDENTIAL_KEYS.apiSecret,
    label: "API Secret (client secret): ",
    masked: true,
  },
  { name: "redirectUri", key: CREDENTIAL_KEYS.redirectUri, label: "Redirect URI: ", masked: false },
];

function resolveFieldsToPrompt(): FieldSpec[] {
  const fieldFlagIndex = process.argv.indexOf("--field");
  if (fieldFlagIndex === -1) return FIELDS;

  const requested = process.argv[fieldFlagIndex + 1];
  const match = FIELDS.find((f) => f.name === requested);
  if (!match) {
    const validNames = FIELDS.map((f) => f.name).join(", ");
    console.error(`Unknown --field "${requested}". Valid values: ${validNames}`);
    process.exit(1);
  }
  return [match];
}

async function main(): Promise<void> {
  const fieldsToPrompt = resolveFieldsToPrompt();
  const isPartial = fieldsToPrompt.length < FIELDS.length;
  console.log(
    isPartial
      ? `Drishti — Upstox Keychain setup. Updating just: ${fieldsToPrompt[0]!.name}.\n`
      : "Drishti — Upstox Keychain setup. Run once. Values are never echoed for masked fields.\n",
  );

  for (const field of fieldsToPrompt) {
    const value = field.masked ? await promptMasked(field.label) : await promptPlain(field.label);
    if (!value) {
      console.error(
        `\nNo value entered for ${field.key} — aborting, nothing partial was saved for this field.`,
      );
      process.exit(1);
    }
    await setCredential(field.key, value);
    console.log(`  stored: ${field.key}`);
  }

  const configured = await listConfiguredKeys(ALL_CREDENTIAL_KEYS);
  const missing = ALL_CREDENTIAL_KEYS.filter((k) => !configured.includes(k));

  console.log("\nVerification:");
  console.log(
    `  ${configured.length}/${ALL_CREDENTIAL_KEYS.length} credentials confirmed present in Keychain.`,
  );
  if (missing.length > 0) {
    console.error(`  MISSING: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Setup complete.");
  process.exit(0);
}

await main();
