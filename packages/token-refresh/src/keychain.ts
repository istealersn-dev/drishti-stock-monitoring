import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_ACCOUNT = "drishti";

export class CredentialNotFoundError extends Error {
  constructor(key: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Keychain read failed for ${key}: ${reason}`);
    this.name = "CredentialNotFoundError";
  }
}

function serviceName(key: string): string {
  return key.startsWith("drishti-upstox-") ? key : `drishti-upstox-${key}`;
}

/**
 * Reads a credential from the macOS Keychain.
 * @param key - Credential key, with or without the `drishti-upstox-` prefix.
 * @returns The stored value.
 * @throws {CredentialNotFoundError} if the read fails for any reason (missing item, locked keychain, denied access).
 */
export async function getCredential(key: string): Promise<string> {
  const service = serviceName(key);
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      KEYCHAIN_ACCOUNT,
      "-s",
      service,
      "-w",
    ]);
    return stdout.trimEnd();
  } catch (e) {
    throw new CredentialNotFoundError(service, e);
  }
}

/**
 * Stores a credential in the macOS Keychain, overwriting any existing value (idempotent).
 * @param key - Credential key, with or without the `drishti-upstox-` prefix.
 * @param value - Value to store.
 * @returns Nothing.
 */
export async function setCredential(key: string, value: string): Promise<void> {
  const service = serviceName(key);
  await execFileAsync("security", [
    "add-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    service,
    "-w",
    value,
    "-U",
  ]);
}

/**
 * Removes a credential from the macOS Keychain.
 * @param key - Credential key, with or without the `drishti-upstox-` prefix.
 * @returns Nothing.
 */
export async function deleteCredential(key: string): Promise<void> {
  const service = serviceName(key);
  await execFileAsync("security", [
    "delete-generic-password",
    "-a",
    KEYCHAIN_ACCOUNT,
    "-s",
    service,
  ]);
}

/**
 * Checks which of the given candidate keys currently resolve to a stored value.
 * @param candidateKeys - Credential keys to check.
 * @returns The subset of candidateKeys that are present in the Keychain.
 */
export async function listConfiguredKeys(candidateKeys: string[]): Promise<string[]> {
  const configured: string[] = [];
  for (const key of candidateKeys) {
    try {
      await getCredential(key);
      configured.push(key);
    } catch (e) {
      if (!(e instanceof CredentialNotFoundError)) throw e;
    }
  }
  return configured;
}
