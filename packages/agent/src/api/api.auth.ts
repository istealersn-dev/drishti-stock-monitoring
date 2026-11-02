import { createHash, timingSafeEqual } from "node:crypto";

const MAX_AUTH_FAILURES = 10;
const AUTH_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 1000;
const MS_PER_SECOND = 1000;

type FailureRecord = { count: number; windowEndsAt: number };

export type AuthThrottle = {
  retryAfterSeconds: (client: string) => number;
  recordFailure: (client: string) => void;
  clear: (client: string) => void;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Compare a supplied access key against the real one in constant time. Both
 * are hashed first because timingSafeEqual needs equal lengths.
 * @param candidate - The untrusted value from the request
 * @param expected - The configured access key
 * @returns True when the key matches
 */
export function isValidAccessKey(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== "string") return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

/**
 * Create an in-memory lockout for repeated bad access keys. Blocking a client
 * also blocks the right key until the window ends, so guesses can't continue.
 * @param now - Clock, injectable for tests
 * @returns Throttle tracking failures per client
 */
export function createAuthThrottle(now: () => number = Date.now): AuthThrottle {
  const failures = new Map<string, FailureRecord>();

  const evictForRoom = (): void => {
    for (const [client, record] of failures) {
      if (record.windowEndsAt <= now()) failures.delete(client);
    }
    if (failures.size < MAX_TRACKED_CLIENTS) return;
    const oldest = failures.keys().next();
    if (!oldest.done) failures.delete(oldest.value);
  };

  return {
    retryAfterSeconds: (client): number => {
      const record = failures.get(client);
      if (!record || record.count < MAX_AUTH_FAILURES) return 0;
      const remainingMs = record.windowEndsAt - now();
      if (remainingMs <= 0) {
        failures.delete(client);
        return 0;
      }
      return Math.ceil(remainingMs / MS_PER_SECOND);
    },
    recordFailure: (client): void => {
      const record = failures.get(client);
      if (record && record.windowEndsAt > now()) {
        record.count += 1;
        return;
      }
      if (failures.size >= MAX_TRACKED_CLIENTS) evictForRoom();
      failures.set(client, { count: 1, windowEndsAt: now() + AUTH_FAILURE_WINDOW_MS });
    },
    clear: (client): void => {
      failures.delete(client);
    },
  };
}
