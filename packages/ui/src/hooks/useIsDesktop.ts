import { useMediaQuery } from "./useMediaQuery";

/** Matches `--breakpoint-tab` in app.css: the desktop shell starts here. */
const DESKTOP_SHELL_QUERY = "(min-width: 578px)";

/**
 * Whether the desktop shell is showing, so pages and the shell can't disagree
 * about which side of the breakpoint they're on.
 * @returns whether the viewport is at or above the desktop shell breakpoint
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_SHELL_QUERY);
}
