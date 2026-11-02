import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "./components/shell/appShell";
import { RouteError } from "./components/shell/routeError";
import { RouteNotFound } from "./components/shell/routeNotFound";
import { RoutePending } from "./components/shell/routePending";
import { isAuthenticated } from "./lib/auth";
import {
  approvalsSearchSchema,
  holdingsSearchSchema,
  settingsSearchSchema,
} from "./lib/routeSearch";

// Long enough that a cached chunk never flashes a spinner.
const ROUTE_PENDING_DELAY_MS = 150;

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyRouteComponent(() => import("./pages/login"), "Login"),
});

// Design-system compliance page. Kept as a standalone root-level route (not nested
// under layoutRoute) so it doesn't render inside AppShell's sidebar/footer chrome — but
// it still needs the same auth guard as every other page, since it ships in the
// production build like the rest of the app.
const tokensRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tokens",
  component: lazyRouteComponent(() => import("./pages/tokensPreview"), "TokensPreview"),
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
});

// CP2 primitives compliance page — same standalone/auth-guarded pattern as tokensRoute.
const primitivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/primitives",
  component: lazyRouteComponent(() => import("./pages/primitivesPreview"), "PrimitivesPreview"),
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
});

// CP3 component catalog page — same standalone/auth-guarded pattern as tokensRoute.
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/catalog",
  component: lazyRouteComponent(() => import("./pages/catalogPreview"), "CatalogPreview"),
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
});

// All authenticated routes live under this layout route.
// beforeLoad fires before every render — unauthenticated users are sent to /login.
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "layout",
  component: AppShell,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/dashboard"), "Dashboard"),
});

const holdingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/holdings",
  validateSearch: holdingsSearchSchema,
  component: lazyRouteComponent(() => import("./pages/holdings"), "Holdings"),
});

const instructionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/instructions",
  validateSearch: approvalsSearchSchema,
  component: lazyRouteComponent(() => import("./pages/instructions"), "Instructions"),
});

const gttRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/gtt",
  component: lazyRouteComponent(() => import("./pages/gtt"), "Gtt"),
});

const watchlistRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/watchlist",
  component: lazyRouteComponent(() => import("./pages/watchlist"), "Watchlist"),
});

const healthRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/health",
  component: lazyRouteComponent(() => import("./pages/health"), "Health"),
});

const askRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/ask",
  component: lazyRouteComponent(() => import("./pages/ask"), "Ask"),
});

const logsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/logs",
  component: lazyRouteComponent(() => import("./pages/logs"), "Logs"),
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/settings",
  validateSearch: settingsSearchSchema,
  component: lazyRouteComponent(() => import("./pages/settings"), "Settings"),
});

const connectBrokerRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/settings/connect/$brokerId",
  component: lazyRouteComponent(() => import("./pages/connectBroker"), "ConnectBroker"),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  tokensRoute,
  primitivesRoute,
  catalogRoute,
  layoutRoute.addChildren([
    indexRoute,
    holdingsRoute,
    instructionsRoute,
    gttRoute,
    watchlistRoute,
    healthRoute,
    askRoute,
    logsRoute,
    settingsRoute,
    connectBrokerRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteNotFound,
  defaultPendingComponent: RoutePending,
  defaultPendingMs: ROUTE_PENDING_DELAY_MS,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
