import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, isNavItemActive } from "../components/shell/navItems";

const APP_NAME = "Drishti";

/**
 * Document title for a route, so tabs and screen readers can tell pages apart.
 * @param pathname - the router's current pathname
 * @returns "<Page> · Drishti", or just the app name for an unknown route
 */
export function pageTitle(pathname: string): string {
  const item = [...MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM].find((navItem) =>
    isNavItemActive(navItem, pathname),
  );
  return item === undefined ? APP_NAME : `${item.label} · ${APP_NAME}`;
}
