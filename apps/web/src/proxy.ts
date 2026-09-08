/**
 * Named `proxy.ts` for Next 16's `proxy` file convention (the successor to
 * `middleware.ts`). The name is not cosmetic: the convention picks the
 * runtime, so a proxy file runs on Node.js while a middleware file ran on the
 * Edge runtime unless it exported `runtime: "nodejs"`. In the build output a
 * proxy file lands in functions-config-manifest.json as
 * `{"/_middleware": {"runtime": "nodejs"}}` with the matcher below.
 *
 * There is no way to keep Edge here — Next throws E1031 for runtime config in
 * a proxy file, and staying on Edge means keeping the deprecated filename.
 * Nothing below needs Edge: it uses only fetch, Headers and NextRequest, and
 * the Node runtime resolves API_INTERNAL_URL through normal DNS.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  needsSessionRefresh,
  spliceRefreshedCookies,
} from "@/lib/session-refresh";

// Server components talk to the API directly — same env var server-api.ts
// and the /api rewrite use.
const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL || "http://localhost:3001";

// Forward the caller's IP like lib/server-api.ts does — better-auth
// rate-limits by IP, and without these headers every proxy fetch would
// count against the web container's address instead of the client's.
function forwardedHeaders(request: NextRequest): Record<string, string> {
  const forwarded: Record<string, string> = {
    cookie: request.headers.get("cookie") ?? "",
  };
  const xff = request.headers.get("x-forwarded-for");
  if (xff) forwarded["x-forwarded-for"] = xff;
  const realIp = request.headers.get("x-real-ip");
  if (realIp) forwarded["x-real-ip"] = realIp;
  return forwarded;
}

function fetchSession(request: NextRequest): Promise<Response> {
  return fetch(`${API_INTERNAL_URL}/api/auth/get-session`, {
    headers: forwardedHeaders(request),
    cache: "no-store",
    // A hung API must not stall every page for visitors with an expired
    // cache cookie: bound the refresh and fall through to serving the page.
    signal: AbortSignal.timeout(2000),
  });
}

/**
 * Refresh the better-auth cookie cache on SSR page loads. better-auth caches
 * the session in a short-lived JWE cookie (session_data, 5 min) so
 * getSession() is DB-free while it's fresh. Direct browser API calls refresh
 * it via Set-Cookie, but SSR sub-fetches (lib/server-api.ts) can't set cookies
 * on the page response — so once the cache cookie expired, every SSR fetch
 * would hit the sessions table until the browser happened to call the API
 * directly. When a request carries a session token but no cache cookie, ask
 * the API for the session once, forward its Set-Cookie headers onto the page
 * response, and splice the refreshed cookies into the forwarded request so
 * this render's own SSR fetches already see the fresh cache.
 *
 * Best-effort — any failure falls through to serving the page.
 */
export async function proxy(request: NextRequest) {
  const cookies = request.cookies.getAll();

  if (!needsSessionRefresh(cookies)) {
    return NextResponse.next();
  }

  try {
    const sessionRes = await fetchSession(request);
    const setCookies = sessionRes.headers.getSetCookie();
    if (!sessionRes.ok || setCookies.length === 0) {
      return NextResponse.next();
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("cookie", spliceRefreshedCookies(cookies, setCookies));

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    for (const setCookie of setCookies) {
      response.headers.append("set-cookie", setCookie);
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  // Pages only: skip the API/WS proxies (they already relay Set-Cookie),
  // Next internals, and static files.
  matcher: ["/((?!api|ws|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};
