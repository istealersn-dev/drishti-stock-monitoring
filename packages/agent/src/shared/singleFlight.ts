/**
 * Create a guard preventing a second async run from starting while a previous
 * one is still in flight — used for both the cron tick and the slow LLM
 * analysis phase so neither can overlap with itself.
 * @returns An object exposing tryRun(), which returns false without invoking
 *   fn if a previous call is still in progress
 */
export function createSingleFlightGuard(): {
  tryRun: (fn: () => Promise<void>) => Promise<boolean>;
} {
  let running = false;

  return {
    async tryRun(fn: () => Promise<void>): Promise<boolean> {
      if (running) return false;
      running = true;
      try {
        await fn();
      } finally {
        running = false;
      }
      return true;
    },
  };
}
