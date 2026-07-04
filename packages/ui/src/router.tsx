import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "./components/shell/appShell";
import { isAuthenticated } from "./lib/auth";
import { Advisor } from "./pages/advisor";
import { CatalogPreview } from "./pages/catalogPreview";
import { Dashboard } from "./pages/dashboard";
import { Gtt } from "./pages/gtt";
import { Health } from "./pages/health";
import { Holdings } from "./pages/holdings";
import { Instructions } from "./pages/instructions";
import { Login } from "./pages/login";
import { Logs } from "./pages/logs";
import { PrimitivesPreview } from "./pages/primitivesPreview";
import { Settings } from "./pages/settings";
import { TokensPreview } from "./pages/tokensPreview";
import { Watchlist } from "./pages/watchlist";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});

// Design-system compliance page. Kept as a standalone root-level route (not nested
// under layoutRoute) so it doesn't render inside AppShell's sidebar/footer chrome — but
// it still needs the same auth guard as every other page, since it ships in the
// production build like the rest of the app.
const tokensRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tokens",
  component: TokensPreview,
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
  component: PrimitivesPreview,
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
  component: CatalogPreview,
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

const watchlistRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/watchlist",
  component: Watchlist,
});

const healthRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/health",
  component: Health,
});

const advisorRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/advisor",
  component: Advisor,
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
    advisorRoute,
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
