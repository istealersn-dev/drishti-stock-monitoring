import { useEffect, useState } from "react";

/**
 * Tracks whether a media query currently matches (handoff.md §3 — pick
 * shell/desktop-vs-mobile components by this, not by duplicating screens).
 * @param query - a media query string, e.g. "(min-width: 760px)"
 * @returns whether the query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);
    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };
    mediaQueryList.addEventListener("change", handleChange);
    return (): void => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
