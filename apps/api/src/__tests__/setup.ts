/**
 * Test setup for better-auth API tests.
 *
 * Creates a test-oriented Hono app that:
 *  - Uses the real database (requires DATABASE_URL)
 *  - Disables captcha (would need external Turnstile verification)
 *  - Keeps all other plugins (admin, username, HIBP, testUtils)
 *  - Disables rate limiting so tests don't interfere with each other
 *  - Initialises the disposable-email blocklist
 */

import { Hono } from "hono";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@app/db";
import * as schema from "@app/db/schema";
import {
  admin,
  username,
  openAPI,
  haveIBeenPwned,
  testUtils,
} from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { validateEmailDomain } from "../services/email-validation.js";
import { initDisposableEmailBlocklist } from "../services/email-validation.js";

// ---------------------------------------------------------------------------
// 1. Initialise blocklist (needed for disposable-email hook)
// ---------------------------------------------------------------------------
await initDisposableEmailBlocklist();

// ---------------------------------------------------------------------------
// 2. Test-specific auth instance
// ---------------------------------------------------------------------------
export const testAuth = betterAuth({
  appName: "TestApp",
  baseURL: "http://localhost:9999",
  basePath: "/api/auth",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  secret: process.env.BETTER_AUTH_SECRET || "test-secret-that-is-long-enough-for-validation",

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplify tests — no email verification needed
    sendResetPassword: async () => {
      // no-op in tests — we just need the endpoint to not 400
    },
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
      username: null,
      displayUsername: null,
      ...additionalFields,
      id,
    }),
  },

  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async () => {
      // no-op in tests
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // Disable rate limiting for most tests (security.test.ts builds its own instance)
  rateLimit: {
    enabled: false,
  },

  plugins: [
    // No captcha in tests — it calls external Turnstile API
    haveIBeenPwned(),
    admin(),
    username(),
    openAPI(),
    testUtils({ captureOTP: true }),
  ],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const email = (ctx.body as Record<string, unknown>)?.email;
        if (email) {
          const result = await validateEmailDomain(email as string);
          if (!result.valid) {
            throw new APIError("BAD_REQUEST", {
              message: result.reason || "Invalid email address",
            });
          }
        }
      }
    }),
  },
});

// ---------------------------------------------------------------------------
// 3. Test Hono app
// ---------------------------------------------------------------------------
const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ status: "ok" }));

app.on(["POST", "GET"], "/auth/**", (c) => {
  return testAuth.handler(c.req.raw);
});

export { app };

// ---------------------------------------------------------------------------
// 4. Helper utilities
// ---------------------------------------------------------------------------

const BASE = "http://localhost:9999";

/** Build a full URL for an auth endpoint (e.g. "/sign-up/email"). */
export function authURL(path: string): string {
  return `${BASE}/api/auth${path}`;
}

/** POST JSON to the test app and return the Response. */
export async function postJSON(
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<Response> {
  return app.fetch(
    new Request(authURL(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

/** GET from the test app. */
export async function getJSON(
  path: string,
  headers?: Record<string, string>,
): Promise<Response> {
  return app.fetch(
    new Request(authURL(path), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }),
  );
}

/** Extract set-cookie header value for session cookie. */
export function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  // Parse "better-auth.session_token=<value>; ..." from set-cookie
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
  return match ? match[1] : null;
}

/** Build a cookie header string from a session token value. */
export function sessionCookieHeader(token: string): string {
  return `better-auth.session_token=${token}`;
}

/** Generate a unique email for test isolation. */
let counter = 0;
export function uniqueEmail(prefix = "test"): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

/** Generate a unique username. */
export function uniqueUsername(prefix = "user"): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

/**
 * Register a user and return the response + parsed body + session cookie.
 * Convenience wrapper around postJSON("/sign-up/email", ...).
 */
export async function registerUser(overrides: {
  name?: string;
  email?: string;
  password?: string;
  username?: string;
} = {}) {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "Str0ng!Pass#2025";
  const name = overrides.name ?? "Test User";

  const body: Record<string, unknown> = { name, email, password };
  if (overrides.username) {
    body.username = overrides.username;
  }

  const res = await postJSON("/sign-up/email", body);
  const data = await res.json();
  const sessionToken = extractSessionCookie(res);

  return { res, data, email, password, name, sessionToken };
}

/**
 * Sign in and return response + session cookie.
 */
export async function signIn(email: string, password: string) {
  const res = await postJSON("/sign-in/email", { email, password });
  const data = await res.json();
  const sessionToken = extractSessionCookie(res);
  return { res, data, sessionToken };
}

/**
 * Get the current session for the given session token.
 */
export async function getSession(sessionToken: string) {
  const res = await getJSON("/get-session", {
    cookie: sessionCookieHeader(sessionToken),
  });
  const data = await res.json();
  return { res, data };
}

/**
 * Use testUtils to directly create + save a user in the database
 * and get auth headers for them. Useful for admin tests.
 */
export async function createAndLoginUser(overrides: {
  email?: string;
  name?: string;
  role?: string;
} = {}) {
  const ctx = await testAuth.$context;
  const testHelpers = (ctx as unknown as { test: typeof ctx & {
    createUser: (data: Record<string, unknown>) => Record<string, unknown>;
    saveUser: (user: Record<string, unknown>) => Promise<Record<string, unknown> & { id: string }>;
    login: (params: { userId: string }) => Promise<{ headers: Headers; session: unknown; token: unknown; cookies: unknown }>;
  } }).test;

  const user = testHelpers.createUser({
    email: overrides.email ?? uniqueEmail(),
    name: overrides.name ?? "Test User",
    emailVerified: true,
    ...(overrides.role ? { role: overrides.role } : {}),
  });

  const savedUser = await testHelpers.saveUser(user);
  const loginResult = await testHelpers.login({ userId: savedUser.id });

  // The testUtils headers contain the properly signed session cookie
  const cookieValue = loginResult.headers.get("cookie") || "";

  return {
    user: savedUser,
    session: loginResult.session,
    headers: loginResult.headers,
    token: loginResult.token,
    cookies: loginResult.cookies,
    /** Cookie header value for use in requests (properly signed) */
    cookieHeader: cookieValue,
  };
}
