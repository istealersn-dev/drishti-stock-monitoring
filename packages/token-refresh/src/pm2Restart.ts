import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PM2_PROCESS_NAME = "drishti-agent";

/**
 * Restarts the running Drishti agent via pm2 so it picks up the freshly-written
 * access token. `env.ts` parses `.env.local` once at process startup — without this,
 * a successful token write sits on disk unused until the process is restarted for
 * an unrelated reason.
 * @returns Nothing.
 * @throws If the `pm2 restart` command fails (pm2 not on PATH, process not found, etc).
 */
export async function restartAgent(): Promise<void> {
  await execFileAsync("pm2", ["restart", PM2_PROCESS_NAME]);
}
