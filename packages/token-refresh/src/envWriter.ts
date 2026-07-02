import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";

const ACCESS_TOKEN_KEY = "UPSTOX_ACCESS_TOKEN";
const REFRESHED_AT_KEY = "UPSTOX_TOKEN_REFRESHED_AT";

function upsertLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  return `${content}${separator}${line}\n`;
}

export async function writeToken(
  envPath: string,
  accessToken: string,
  refreshedAt: Date,
): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(envPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  let updated = upsertLine(existing, ACCESS_TOKEN_KEY, accessToken);
  updated = upsertLine(updated, REFRESHED_AT_KEY, refreshedAt.toISOString());

  const temporaryPath = `${envPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, updated, "utf8");
  await rename(temporaryPath, envPath);
}
