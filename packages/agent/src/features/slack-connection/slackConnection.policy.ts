/**
 * How long the Socket Mode client may stay disconnected before we treat the
 * connection as unrecoverable. Slack's own reconnect backoff settles well
 * inside a minute, so anything past this is the client having parked itself
 * in a dead state rather than a transient network blip.
 */
export const SLACK_RECONNECT_GRACE_MS = 3 * 60_000;

export type SlackConnectionVerdict = "healthy" | "recovering" | "stalled";

export type SlackConnectionSnapshot = {
  /** Whether the client has reported `connected` more recently than any disconnect. */
  connected: boolean;
  /** Epoch ms of the most recent transition away from `connected`, or null while connected. */
  disconnectedSince: number | null;
  /** Epoch ms to judge against. */
  now: number;
  /** Grace period before a disconnect counts as stalled. */
  graceMs?: number;
};

/**
 * Decide whether a Socket Mode connection is healthy, still legitimately
 * reconnecting, or stalled beyond recovery.
 *
 * Exists because @slack/socket-mode@1.3.6 can strand its state machine: if the
 * host sleeps mid-handshake, the client takes a `server explicit disconnect`
 * while in state `connecting`, throws an unhandled-transition error, and stops
 * reconnecting without ever emitting `disconnected`. The process stays alive
 * and healthy-looking while Slack traffic silently stops.
 * @param snapshot - Current connection state and the time to judge it at
 * @returns "healthy" while connected, "recovering" inside the grace period, "stalled" past it
 */
export function judgeSlackConnection(snapshot: SlackConnectionSnapshot): SlackConnectionVerdict {
  const { connected, disconnectedSince, now } = snapshot;
  const graceMs = snapshot.graceMs ?? SLACK_RECONNECT_GRACE_MS;

  if (connected) return "healthy";
  if (disconnectedSince === null) return "recovering";
  return now - disconnectedSince >= graceMs ? "stalled" : "recovering";
}
