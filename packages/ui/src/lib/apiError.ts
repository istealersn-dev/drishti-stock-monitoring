/**
 * The Drishti agent could not be reached at all — the fetch itself failed
 * (process down, wrong port, tunnel offline), so no HTTP response came back.
 * Distinct from an error *response*, which means the agent is up but something
 * downstream (e.g. the broker) failed.
 */
export class AgentUnreachableError extends Error {
  constructor(public readonly reason?: unknown) {
    super("Cannot reach the Drishti agent");
    this.name = "AgentUnreachableError";
  }
}

/**
 * The agent responded with a non-OK HTTP status. Carries the status and the
 * optional machine-readable `code` the agent attaches (e.g.
 * "BROKER_UNAUTHORIZED"), so callers can branch on the cause instead of
 * pattern-matching a human-readable message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
