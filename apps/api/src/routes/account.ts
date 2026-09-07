import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../lib/auth.js";
import { badRequest } from "../lib/errors.js";
import { guardImpersonation } from "../lib/impersonation.js";
import { requireAuth, type AuthUser } from "../middleware/auth.js";

export const accountRoutes = new Hono<{
  Variables: { auth: AuthUser };
}>();

accountRoutes.use("/*", requireAuth);

// better-auth's own /change-password needs the current password and its
// setPassword endpoint is deliberately server-only, so a user who signed up
// through an OAuth provider has no way to add a password without this
// bridge. Length bounds mirror better-auth's password config; the body is
// strict so a stray `currentPassword` can't be silently ignored.
const setPasswordSchema = z.strictObject({
  newPassword: z.string().min(8).max(128),
});

accountRoutes.post("/set-password", async (c) => {
  // A support session may look at the account but must not lock its owner
  // out by setting a password on their behalf.
  guardImpersonation(c.get("auth"));

  const parsed = setPasswordSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) throw badRequest("Invalid request body");

  // better-auth resolves the session from the forwarded headers itself and
  // answers 400 PASSWORD_ALREADY_SET when a credential password exists.
  return auth.api.setPassword({
    body: { newPassword: parsed.data.newPassword },
    headers: c.req.raw.headers,
    asResponse: true,
  });
});
