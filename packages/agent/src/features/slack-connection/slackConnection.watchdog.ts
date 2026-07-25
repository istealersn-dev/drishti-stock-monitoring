import { logger } from "../../shared/logger.js";

import { judgeSlackConnection, SLACK_RECONNECT_GRACE_MS } from "./slackConnection.policy.js";

/**
 * The slice of the Socket Mode client this module needs — an event emitter.
 * Structural rather than the concrete SocketModeClient so the watchdog can be
 * exercised without a live Slack connection.
 */
type SocketModeConnection = {
  on: (event: string, listener: (payload?: unknown) => void) => unknown;
};

const CHECK_INTERVAL_MS = 30_000;

type WatchdogOptions = {
  /**
   * Called once when the connection is judged stalled. Expected to end the
   * process so the supervisor (pm2) restarts it with a fresh socket — an
   * in-place reconnect is not reliable once the client's state machine has
   * been stranded.
   */
  onStalled: (disconnectedForMs: number) => void;
  graceMs?: number;
};

/**
 * Watch a Socket Mode connection and report when it stops recovering.
 *
 * The client is trusted to reconnect on its own; this only catches the case
 * where it silently stops trying. Because a stranded client can skip the
 * `disconnected` event entirely, liveness is tracked from the `connected`
 * event rather than from disconnect events alone — the clock starts at
 * startup and only stops once Slack is actually reachable.
 * @param client - Socket Mode client to observe
 * @param options.onStalled - Invoked once when the disconnect outlives the grace period
 * @param options.graceMs - Override the grace period before a disconnect counts as stalled
 * @returns A function that stops the watchdog
 */
export function startSlackConnectionWatchdog(
  client: SocketModeConnection,
  options: WatchdogOptions,
): () => void {
  const graceMs = options.graceMs ?? SLACK_RECONNECT_GRACE_MS;
  let connected = false;
  let disconnectedSince: number | null = Date.now();
  let stalledReported = false;

  client.on("connected", () => {
    if (!connected) logger.info("Slack Socket Mode connected");
    connected = true;
    disconnectedSince = null;
    stalledReported = false;
  });

  for (const event of ["disconnected", "disconnecting", "reconnecting", "connecting"]) {
    client.on(event, () => {
      if (connected) {
        logger.warn("Slack Socket Mode connection lost", { event });
      }
      connected = false;
      disconnectedSince ??= Date.now();
    });
  }

  client.on("error", (error: unknown) => {
    logger.error("Slack Socket Mode error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  client.on("unable_to_socket_mode_start", (error: unknown) => {
    logger.error("Slack Socket Mode failed to start", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const timer = setInterval(() => {
    const now = Date.now();
    const verdict = judgeSlackConnection({ connected, disconnectedSince, now, graceMs });
    if (verdict !== "stalled" || stalledReported) return;

    stalledReported = true;
    const disconnectedForMs = disconnectedSince === null ? graceMs : now - disconnectedSince;
    logger.error("Slack Socket Mode stalled — no connection past grace period", {
      disconnectedForMs,
      graceMs,
    });
    options.onStalled(disconnectedForMs);
  }, CHECK_INTERVAL_MS);

  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
