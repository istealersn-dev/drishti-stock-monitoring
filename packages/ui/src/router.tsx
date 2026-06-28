import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { Shell } from "./components/layout/shell";
import { isAuthenticated } from "./lib/auth";
import { Dashboard } from "./pages/dashboard";
import { Gtt } from "./pages/gtt";
import { Holdings } from "./pages/holdings";
import { Instructions } from "./pages/instructions";
import { Login } from "./pages/login";
import { Logs } from "./pages/logs";
import { Settings } from "./pages/settings";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});

// All authenticated routes live under this layout route.
// beforeLoad fires before every render — unauthenticated users are sent to /login.
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "layout",
  component: Shell,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/",
  component: Dashboard,
});

const holdingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/holdings",
  component: Holdings,
});

const instructionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/instructions",
  component: Instructions,
});

const gttRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/gtt",
  component: Gtt,
});

const logsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/logs",
  component: Logs,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  layoutRoute.addChildren([
    indexRoute,
    holdingsRoute,
    instructionsRoute,
    gttRoute,
    logsRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
