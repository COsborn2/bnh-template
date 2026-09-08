import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { isPasswordCompromised } from "better-auth/plugins";
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
  const { newPassword } = parsed.data;

  // The haveIBeenPwned plugin only guards endpoints it can match by path
  // (sign-up, change-password, reset-password, ...). setPassword is
  // server-only and has no path, so the same breached-password check runs
  // here; otherwise this route would accept passwords every other path
  // rejects. An HIBP outage throws better-auth's INTERNAL_SERVER_ERROR,
  // exactly as sign-up does.
  if (await isPasswordCompromised(newPassword)) {
    return c.json(
      {
        error:
          "The password you entered has been compromised. Please choose a different password.",
        code: "PASSWORD_COMPROMISED",
      },
      400,
    );
  }

  // better-auth resolves the session from the forwarded headers itself and
  // answers PASSWORD_ALREADY_SET when a credential password exists. Its
  // APIError body is `{ code, message }`; the web client reads `error`, so
  // rethrow it in the app's shape (keeping `code` for callers that branch).
  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: c.req.raw.headers,
    });
    return c.json({ status: true });
  } catch (err) {
    if (err instanceof APIError) {
      const code =
        typeof err.body?.code === "string" ? err.body.code : undefined;
      return c.json(
        { error: err.message, code },
        err.statusCode as ContentfulStatusCode,
      );
    }
    throw err;
  }
});
