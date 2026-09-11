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

async function resolveAuthSession(request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return null;
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
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? null,
    impersonatedBy: sessionMeta?.impersonatedBy ?? null,
  };
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
  const authUser = await resolveAuthSession(c.req.raw);
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
  const authUser = await resolveAuthSession(c.req.raw);
  c.set("auth", authUser);
  await next();
});
