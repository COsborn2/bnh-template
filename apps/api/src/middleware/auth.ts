import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { unauthorized } from "../lib/errors.js";
import { auth } from "../lib/auth.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string | null;
  /** Admin user id when this session is a better-auth admin impersonation
   *  (admin plugin); call guardImpersonation() (lib/impersonation.ts) before
   *  writes a support session must not perform on the user's behalf. */
  impersonatedBy: string | null;
};

interface ResolvedSession {
  user: AuthUser | null;
  /** Set-Cookie values better-auth produced while resolving the session —
   *  see forwardSessionCookies. */
  setCookies: string[];
}

async function resolveAuthSession(request: Request): Promise<ResolvedSession> {
  // returnHeaders: when the 5-minute cookie cache (lib/auth.ts) has lapsed,
  // getSession reads the session row and re-issues the cache cookie. Without
  // forwarding that Set-Cookie, a client that stays on one page (no SSR
  // navigation for proxy.ts to refresh it through) paid a session query
  // before every API request from minute five on; with it, one request per
  // five minutes does.
  const { headers, response: session } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const setCookies = headers?.getSetCookie() ?? [];

  if (!session?.user?.id) {
    return { user: null, setCookies };
  }

  const user = session.user as {
    id: string;
    email: string;
    name: string;
    role?: string | null;
  };
  const sessionMeta = session.session as
    | { impersonatedBy?: string | null }
    | undefined;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? null,
      impersonatedBy: sessionMeta?.impersonatedBy ?? null,
    },
    setCookies,
  };
}

/** Pass better-auth's refreshed (or expired-session cleanup) cookies on to
 *  the browser. Set before next() so they ride whatever response the route
 *  — or the error handler — ends up producing. */
export function forwardSessionCookies(c: Context, setCookies: string[]): void {
  for (const cookie of setCookies) {
    c.header("set-cookie", cookie, { append: true });
  }
}

/**
 * Requires a valid better-auth session; responds 401 otherwise. Sets
 * `c.var.auth` to the resolved user. Layer role checks on top in the route,
 * and refuse writes a support session must not perform on the user's behalf
 * with guardImpersonation() (lib/impersonation.ts):
 *
 *   route.get("/users", requireAuth, (c) => {
 *     if (c.get("auth").role !== "admin") throw forbidden("Admin only");
 *     ...
 *   });
 *
 *   route.post("/set-password", requireAuth, (c) => {
 *     guardImpersonation(c.get("auth")); // 403 while impersonating
 *     ...
 *   });
 */
export const requireAuth = createMiddleware<{
  Variables: { auth: AuthUser };
}>(async (c, next) => {
  const { user: authUser, setCookies } = await resolveAuthSession(c.req.raw);
  forwardSessionCookies(c, setCookies);
  if (!authUser) {
    throw unauthorized("Authentication required");
  }

  c.set("auth", authUser);
  await next();
});

/**
 * Resolves the better-auth session when present, but never rejects. Sets
 * `c.var.auth` to the user or null, for routes that behave differently for
 * signed-in users.
 */
export const optionalAuth = createMiddleware<{
  Variables: { auth: AuthUser | null };
}>(async (c, next) => {
  const { user: authUser, setCookies } = await resolveAuthSession(c.req.raw);
  forwardSessionCookies(c, setCookies);
  c.set("auth", authUser);
  await next();
});
