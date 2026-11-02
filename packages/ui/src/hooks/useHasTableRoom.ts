import { tokens } from "../tokens/tokens";

import { useMediaQuery } from "./useMediaQuery";

const TABLE_ROOM_QUERY = `(min-width: ${tokens.breakpoint.nav}px)`;

/**
 * Whether wide data tables fit. Later than the desktop shell's breakpoint: a
 * phone-landscape width gets the sidebar but still reads better as cards.
 * @returns whether to render tables rather than cards
 */
export function useHasTableRoom(): boolean {
  return useMediaQuery(TABLE_ROOM_QUERY);
}
