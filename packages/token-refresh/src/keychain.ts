import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_ACCOUNT = "drishti";

export class CredentialNotFoundError extends Error {
  constructor(key: string) {
    super(`Keychain credential not found: ${key}`);
    this.name = "CredentialNotFoundError";
  }
}

function serviceName(key: string): string {
  return key.startsWith("drishti-upstox-") ? key : `drishti-upstox-${key}`;
}

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
  } catch {
    throw new CredentialNotFoundError(service);
  }
}

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
