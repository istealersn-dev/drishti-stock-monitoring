import { tokens } from "../tokens/tokens";

import { useMediaQuery } from "./useMediaQuery";

const DESKTOP_SHELL_QUERY = `(min-width: ${tokens.breakpoint.tab}px)`;

/**
 * Whether the desktop shell is showing, so pages and the shell can't disagree
 * about which side of the breakpoint they're on.
 * @returns whether the viewport is at or above the desktop shell breakpoint
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_SHELL_QUERY);
}
