/**
 * POST /api/account/set-password — the bridge to better-auth's server-only
 * setPassword (routes/account.ts), driven through the PRODUCTION Hono app so
 * requireAuth and the delegated call both use the production auth instance
 * (lib/auth.ts). Sessions are minted by the test auth instance in setup.ts:
 * both share DATABASE_URL and BETTER_AUTH_SECRET (and the cookie name — both
 * base URLs are plain http), so its signed cookies verify here. Requires a
 * real DATABASE_URL, as in CI.
 */

import { describe, expect, test } from "bun:test";
import {
  createAndLoginUser,
  extractSessionCookie,
  postJSON,
  registerUser,
  sessionCookieHeader,
  signIn,
  uniqueEmail,
} from "./setup.js";

process.env.BETTER_AUTH_SECRET ??=
  "test-secret-that-is-long-enough-for-validation";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";

const { app } = await import("../app.js");

const NEW_PASSWORD = "Set-Passw0rd!Xy7#Local";

async function setPassword(body: unknown, cookie?: string): Promise<Response> {
  return await app.request("/api/account/set-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/account/set-password", () => {
  test("anonymous requests get 401", async () => {
    const res = await setPassword({ newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  test("invalid bodies get 400 before better-auth is reached", async () => {
    const user = await createAndLoginUser({ email: uniqueEmail("setpw-bad") });

    for (const body of [
      { newPassword: "short" },
      { newPassword: "x".repeat(129) },
      { newPassword: NEW_PASSWORD, currentPassword: "ignored" },
      {},
      "not json",
    ]) {
      const res = await setPassword(body, user.cookieHeader);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid request body" });
    }
  });

  test("links a credential account for a user without one; the password then signs in", async () => {
    // testUtils users are saved without any account row — the OAuth-only
    // shape this route exists for.
    const user = await createAndLoginUser({ email: uniqueEmail("setpw") });

    const res = await setPassword(
      { newPassword: NEW_PASSWORD },
      user.cookieHeader,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: true });

    const login = await signIn(user.user.email as string, NEW_PASSWORD);
    expect(login.res.status).toBe(200);
    expect(login.sessionToken).toBeTruthy();

    // better-auth refuses to overwrite a password that now exists.
    const again = await setPassword(
      { newPassword: `${NEW_PASSWORD}-2` },
      user.cookieHeader,
    );
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe("PASSWORD_ALREADY_SET");
  });

  test("a breached password is refused before better-auth is reached", async () => {
    const user = await createAndLoginUser({ email: uniqueEmail("setpw-hibp") });

    // "password123" is one of the most common breached passwords; the same
    // check rejects it on sign-up, change-password and reset-password.
    const res = await setPassword(
      { newPassword: "password123" },
      user.cookieHeader,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("PASSWORD_COMPROMISED");
    expect(body.error.toLowerCase()).toContain("compromised");
  });

  test("a credential user gets better-auth's PASSWORD_ALREADY_SET (400)", async () => {
    const reg = await registerUser();
    expect(reg.sessionToken).toBeTruthy();

    const res = await setPassword(
      { newPassword: NEW_PASSWORD },
      sessionCookieHeader(reg.sessionToken!),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("PASSWORD_ALREADY_SET");
    // better-auth's message travels under the app's `error` key.
    expect(typeof body.error).toBe("string");
  });

  test("an admin impersonation session is refused with 403", async () => {
    const admin = await createAndLoginUser({
      email: uniqueEmail("admin"),
      role: "admin",
    });
    const target = await createAndLoginUser({ email: uniqueEmail("target") });

    const impersonate = await postJSON(
      "/admin/impersonate-user",
      { userId: target.user.id },
      { cookie: admin.cookieHeader },
    );
    expect(impersonate.status).toBe(200);
    const token = extractSessionCookie(impersonate);
    expect(token).toBeTruthy();

    const res = await setPassword(
      { newPassword: NEW_PASSWORD },
      sessionCookieHeader(token!),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Not available while impersonating",
    });
  });
});
