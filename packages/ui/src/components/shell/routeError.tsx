import type { ErrorComponentProps } from "@tanstack/react-router";
import type React from "react";
import { useEffect } from "react";

import { Button } from "../ui/button";
import { ErrorNotice } from "../ui/errorNotice";

/**
 * Fallback for a render or chunk-load failure in a route. Reloading also
 * recovers from a stale chunk after a new deploy.
 * @param props.error - The failure, logged so it can be diagnosed
 * @returns Route error element
 */
export function RouteError({ error }: ErrorComponentProps): React.ReactElement {
  useEffect(() => {
    console.error("Route failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <ErrorNotice>Something went wrong displaying this page.</ErrorNotice>
      <Button
        variant="secondary"
        onClick={() => {
          window.location.reload();
        }}
      >
        Reload
      </Button>
    </div>
  );
}
