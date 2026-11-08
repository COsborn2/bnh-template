/**
 * requireAuth / optionalAuth (middleware/auth.ts) pass on the session cookies
 * better-auth issues while resolving the session. Without that, a client
 * whose 5-minute cookie cache (session_data) had lapsed never got a fresh
 * one from the app's own routes, so every request it made paid a session
 * query until something else (an SSR navigation through proxy.ts, a
 * get-session call) refreshed it. Driven through the PRODUCTION Hono app;
 * sessions are minted by the test auth instance in setup.ts (same database,
 * secret and cookie names). Requires a real DATABASE_URL, as in CI.
 */

import { describe, expect, test } from "bun:test";
import { createAndLoginUser } from "./setup.js";

process.env.BETTER_AUTH_SECRET ??=
  "test-secret-that-is-long-enough-for-validation";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";

const { app } = await import("../app.js");

const CACHE_COOKIE = "better-auth.session_data=";

async function getAvatar(cookie: string): Promise<Response> {
  return await app.request("/api/account/avatar", { headers: { cookie } });
}

/** The name=value part of the cache cookie in a response, if it set one. */
function cacheCookie(res: Response): string | undefined {
  return res.headers
    .getSetCookie()
    .find((c) => c.startsWith(CACHE_COOKIE))
    ?.split(";")[0];
}

describe("session cookie cache through the app's own routes", () => {
  test("a request without the cache cookie gets a fresh one", async () => {
    const { cookieHeader } = await createAndLoginUser();
    expect(cookieHeader).not.toContain(CACHE_COOKIE);

    const res = await getAvatar(cookieHeader);
    expect(res.status).toBe(200);
    const cached = cacheCookie(res);
    expect(cached).toBeDefined();
    expect(cached!.length).toBeGreaterThan(CACHE_COOKIE.length);
  });

  test("while the cache cookie is fresh, no new one is issued", async () => {
    const { cookieHeader } = await createAndLoginUser();
    const cached = cacheCookie(await getAvatar(cookieHeader));
    expect(cached).toBeDefined();

    const res = await getAvatar(`${cookieHeader}; ${cached}`);
    expect(res.status).toBe(200);
    expect(cacheCookie(res)).toBeUndefined();
  });

  test("anonymous requests still get 401 and no session cookies", async () => {
    const res = await app.request("/api/account/avatar");
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
