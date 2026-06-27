import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { Shell } from "./components/layout/shell";
import { Dashboard } from "./pages/dashboard";
import { Gtt } from "./pages/gtt";
import { Holdings } from "./pages/holdings";
import { Instructions } from "./pages/instructions";
import { Logs } from "./pages/logs";
import { Settings } from "./pages/settings";

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const holdingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/holdings",
  component: Holdings,
});

const instructionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/instructions",
  component: Instructions,
});

const gttRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gtt",
  component: Gtt,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logs",
  component: Logs,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  holdingsRoute,
  instructionsRoute,
  gttRoute,
  logsRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
