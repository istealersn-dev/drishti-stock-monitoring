export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Wrap a successful value in a Result.
 * @param value - The success value
 * @returns A successful Result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Wrap an error in a Result.
 * @param error - The error
 * @returns A failed Result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export class UpstoxError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "UpstoxError";
  }
}

export class SlackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackError";
  }
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}
