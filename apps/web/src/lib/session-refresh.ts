/**
 * Pure helpers for the session-refresh proxy (src/proxy.ts) —
 * kept separate so the cookie handling is unit-testable without the Next
 * runtime.
 */

export interface CookiePair {
  name: string;
  value: string;
}

/**
 * Whether the request carries a better-auth session token. Names are matched
 * by substring, mirroring noAccessRedirectPath (lib/server-api.ts):
 * better-auth's names contain "session_token" in every configuration we run
 * (secure-prefix included).
 */
export function hasSessionToken(cookies: CookiePair[]): boolean {
  return cookies.some((c) => c.name.includes("session_token"));
}

/**
 * A request needs a session refresh when it carries a better-auth session
 * token but no cookie-cache cookie (the 5-minute JWE cache expired or was
 * never set — "session_data" is the JWE cache's name substring).
 */
export function needsSessionRefresh(cookies: CookiePair[]): boolean {
  const hasCache = cookies.some((c) => c.name.includes("session_data"));
  return hasSessionToken(cookies) && !hasCache;
}

/**
 * Rebuild a request Cookie header with the refreshed cookies from the API's
 * Set-Cookie headers spliced in, replacing any same-name entries so the
 * render sees exactly what the browser would after the response lands.
 */
export function spliceRefreshedCookies(
  cookies: CookiePair[],
  setCookies: string[],
): string {
  const refreshed = new Map<string, string>();
  for (const setCookie of setCookies) {
    const pair = setCookie.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq > 0) refreshed.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  return [
    ...cookies
      .filter((c) => !refreshed.has(c.name))
      .map((c) => `${c.name}=${c.value}`),
    ...[...refreshed.entries()].map(([name, value]) => `${name}=${value}`),
  ].join("; ");
}
