/**
 * End-to-end test for the two-step change-email flow, driven through the
 * PRODUCTION auth instance (lib/auth.ts) so the real wiring is exercised:
 *
 *   1. POST /change-email            → approval email to the CURRENT address
 *   2. GET approval link (old email) → verification email to the NEW address
 *   3. GET verification link         → user row updated + "email changed"
 *                                      notice to the OLD address
 *
 * @app/email is mocked so each outbound email (recipient + action URL) can be
 * captured and its link "clicked". Requires a real DATABASE_URL (the suite
 * runs against the migrated test database, as in CI).
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { db } from "@app/db";
import { user as userTable } from "@app/db/schema";
import { eq } from "drizzle-orm";
import { createEmailVerificationToken } from "better-auth/api";

// ---------------------------------------------------------------------------
// 1. Environment + email capture (must be in place before lib/auth.js loads)
// ---------------------------------------------------------------------------

process.env.BETTER_AUTH_SECRET ??=
  "test-secret-that-is-long-enough-for-validation";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
// Cloudflare's always-passing test secret; captcha-protected endpoints are
// not exercised here, this only keeps the plugin config well-formed.
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";

interface CapturedEmail {
  kind:
    | "verification"
    | "password-reset"
    | "password-changed"
    | "email-changed"
    | "change-approval"
    | "delete-account";
  to: string;
  url?: string;
  newEmail?: string;
}

const captured: CapturedEmail[] = [];

mock.module("@app/email", () => ({
  sendVerificationEmail: async (to: string, url: string) => {
    captured.push({ kind: "verification", to, url });
  },
  sendPasswordResetEmail: async (to: string, url: string) => {
    captured.push({ kind: "password-reset", to, url });
  },
  sendPasswordChangedEmail: async (to: string) => {
    captured.push({ kind: "password-changed", to });
  },
  sendEmailChangedEmail: async (to: string, newEmail: string) => {
    captured.push({ kind: "email-changed", to, newEmail });
  },
  sendEmailChangeApprovalEmail: async (
    to: string,
    newEmail: string,
    url: string,
  ) => {
    captured.push({ kind: "change-approval", to, newEmail, url });
  },
  sendDeleteAccountVerificationEmail: async (to: string, url: string) => {
    captured.push({ kind: "delete-account", to, url });
  },
}));

const { auth } = await import("../lib/auth.js");
const { betterAuthBaseUrl } = await import("../lib/config.js");

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

/** Create a user directly via the testUtils plugin and log them in. */
async function createLoggedInUser(overrides: { emailVerified: boolean }) {
  const ctx = await auth.$context;
  const testHelpers = (
    ctx as unknown as {
      test: {
        createUser: (data: Record<string, unknown>) => Record<string, unknown>;
        saveUser: (
          user: Record<string, unknown>,
        ) => Promise<Record<string, unknown> & { id: string; email: string }>;
        login: (params: { userId: string }) => Promise<{ headers: Headers }>;
      };
    }
  ).test;

  const user = testHelpers.createUser({
    email: uniqueEmail("change-email"),
    name: "Change Email User",
    emailVerified: overrides.emailVerified,
  });
  const savedUser = await testHelpers.saveUser(user);
  const loginResult = await testHelpers.login({ userId: savedUser.id });

  return {
    user: savedUser,
    cookieHeader: loginResult.headers.get("cookie") || "",
  };
}

function postChangeEmail(cookieHeader: string, body: Record<string, unknown>) {
  return auth.handler(
    new Request(`${betterAuthBaseUrl}/api/auth/change-email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: betterAuthBaseUrl,
        "x-real-ip": "127.0.0.1",
        cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Simulate the user clicking an emailed link. */
function clickLink(url: string, cookieHeader: string) {
  return auth.handler(
    new Request(url, {
      headers: {
        "x-real-ip": "127.0.0.1",
        cookie: cookieHeader,
      },
    }),
  );
}

async function getUserRow(userId: string) {
  const rows = await db
    .select({ email: userTable.email, emailVerified: userTable.emailVerified })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return rows[0];
}

function capturedOfKind(kind: CapturedEmail["kind"]): CapturedEmail[] {
  return captured.filter((email) => email.kind === kind);
}

beforeEach(() => {
  captured.length = 0;
});

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------

describe("Change email flow", () => {
  test("completes end-to-end: approval to old address, verification to new address, then the changed email row", async () => {
    const { user, cookieHeader } = await createLoggedInUser({
      emailVerified: true,
    });
    const oldEmail = user.email;
    const newEmail = uniqueEmail("changed-to");

    // Step 1: request the change.
    const changeRes = await postChangeEmail(cookieHeader, {
      newEmail,
      callbackURL: "/account",
    });
    expect(changeRes.status).toBe(200);
    expect(await changeRes.json()).toEqual({ status: true });

    // The approval email goes to the CURRENT address and carries a link.
    const approvals = capturedOfKind("change-approval");
    expect(approvals).toHaveLength(1);
    expect(approvals[0].to).toBe(oldEmail);
    expect(approvals[0].newEmail).toBe(newEmail);
    expect(approvals[0].url).toContain("/api/auth/verify-email?token=");

    // Nothing has changed yet, and no "changed" notice has been sent.
    expect(capturedOfKind("email-changed")).toHaveLength(0);
    expect(capturedOfKind("verification")).toHaveLength(0);
    expect((await getUserRow(user.id)).email).toBe(oldEmail);

    // Step 2: the old address approves the change.
    const approvalClick = await clickLink(approvals[0].url!, cookieHeader);
    expect(approvalClick.status).toBe(302);
    expect(approvalClick.headers.get("location") ?? "").not.toContain(
      "error=",
    );

    // The standard verification email goes to the NEW address, with the
    // /dashboard callback applied by buildVerificationUrl.
    const verifications = capturedOfKind("verification");
    expect(verifications).toHaveLength(1);
    expect(verifications[0].to).toBe(newEmail);
    expect(verifications[0].url).toContain("/api/auth/verify-email?token=");
    expect(verifications[0].url).toContain("callbackURL=%2Fdashboard");

    // Still nothing changed until the new address verifies.
    expect(capturedOfKind("email-changed")).toHaveLength(0);
    expect((await getUserRow(user.id)).email).toBe(oldEmail);

    // Step 3: the new address verifies.
    const verifyClick = await clickLink(verifications[0].url!, cookieHeader);
    expect(verifyClick.status).toBe(302);
    expect(verifyClick.headers.get("location") ?? "").not.toContain("error=");

    // The user row is updated…
    const row = await getUserRow(user.id);
    expect(row.email).toBe(newEmail);
    expect(row.emailVerified).toBe(true);

    // …and only now does the "your email was changed" notice go to the OLD
    // address, naming the new one.
    const notices = capturedOfKind("email-changed");
    expect(notices).toHaveLength(1);
    expect(notices[0].to).toBe(oldEmail);
    expect(notices[0].newEmail).toBe(newEmail);
  });

  test("plain email verification does not send the email-changed notice", async () => {
    const { user, cookieHeader } = await createLoggedInUser({
      emailVerified: false,
    });

    // Build a first-time verification token exactly like better-auth does
    // for sign-up verification (no updateTo/requestType claims).
    const token = await createEmailVerificationToken(
      process.env.BETTER_AUTH_SECRET!,
      user.email,
    );
    const verifyRes = await clickLink(
      `${betterAuthBaseUrl}/api/auth/verify-email?token=${token}&callbackURL=%2Fdashboard`,
      cookieHeader,
    );
    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.get("location") ?? "").not.toContain("error=");

    const row = await getUserRow(user.id);
    expect(row.email).toBe(user.email);
    expect(row.emailVerified).toBe(true);

    expect(capturedOfKind("email-changed")).toHaveLength(0);
  });
});
