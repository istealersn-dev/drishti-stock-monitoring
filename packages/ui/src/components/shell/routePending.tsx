import type React from "react";

import { Spinner } from "../ui/spinner";

/**
 * Shown while a lazy route's code loads.
 * @returns Route pending element
 */
export function RoutePending(): React.ReactElement {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  );
}
