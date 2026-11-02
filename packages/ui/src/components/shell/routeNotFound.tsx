import { Link } from "@tanstack/react-router";
import type React from "react";

/**
 * Fallback for a URL that matches no route.
 * @returns Not-found element
 */
export function RouteNotFound(): React.ReactElement {
  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <h1 className="text-title font-semibold text-fg">Page not found</h1>
      <Link to="/" className="text-body-sm text-gold underline">
        Back to dashboard
      </Link>
    </div>
  );
}
