import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@app/db";
import * as schema from "@app/db/schema";
import {
  admin,
  username,
  openAPI,
  captcha,
  haveIBeenPwned,
  testUtils,
} from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangedEmail,
  sendEmailChangeApprovalEmail,
  sendDeleteAccountVerificationEmail,
} from "@app/email";
import { validateEmailDomain } from "../services/email-validation.js";
import { deleteAccountData } from "../services/account.js";
import { eq } from "drizzle-orm";
import { user as userTable } from "@app/db/schema";
import { betterAuthBaseUrl } from "./config.js";
import {
  betterAuthRateLimitStorage,
  consumeEmailSendLimit,
  isRateLimitError,
} from "./rate-limits.js";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Gate every outbound auth email behind the per-recipient rate limit
 * (lib/rate-limits.ts). On a limit hit we log and silently skip the send —
 * returning success so the endpoint doesn't leak whether the recipient
 * exists — instead of erroring. This bounds mail-bombing by who is being
 * mailed, regardless of who is mailing (better-auth's own limiter is only
 * per-IP per-route).
 */
async function sendRateLimitedAuthEmail(
  input: { type: string; to: string },
  send: () => Promise<unknown>,
): Promise<void> {
  try {
    await consumeEmailSendLimit(input.to);
  } catch (err) {
    if (isRateLimitError(err)) {
      console.warn(
        `[auth] Skipping ${input.type} email to rate-limited target (${err.policy.id})`,
      );
      return;
    }
    throw err;
  }

  await send();
}

/** Ensure the verification URL always redirects to /dashboard after verification. */
export function buildVerificationUrl(url: string): string {
  const verifyUrl = new URL(url);
  verifyUrl.searchParams.set("callbackURL", "/dashboard");
  return verifyUrl.toString();
}

interface VerificationTokenPayload {
  email: string;
  updateTo?: string;
  requestType?: string;
}

/**
 * Decodes the payload of the `token` query param on a /verify-email request.
 * Better Auth has already verified the JWT signature by the time our
 * `afterEmailVerification` hook runs, so a plain base64url decode is safe
 * here — we only need to read which flow the token belongs to.
 */
function parseVerificationTokenPayload(
  request: Request | undefined,
): VerificationTokenPayload | null {
  if (!request) return null;
  try {
    const token = new URL(request.url).searchParams.get("token");
    const payloadSegment = token?.split(".")[1];
    if (!payloadSegment) return null;
    const parsed: unknown = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.email !== "string") return null;
    return {
      email: record.email,
      updateTo:
        typeof record.updateTo === "string" ? record.updateTo : undefined,
      requestType:
        typeof record.requestType === "string" ? record.requestType : undefined,
    };
  } catch {
    return null;
  }
}

export const auth = betterAuth({
  appName: process.env.APP_NAME || "MyApp",
  baseURL: betterAuthBaseUrl,
  basePath: "/api/auth",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  secret: process.env.BETTER_AUTH_SECRET!,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendRateLimitedAuthEmail(
        {
          type: "password-reset",
          to: user.email,
        },
        () => sendPasswordResetEmail(user.email, url),
      );
    },
    // With requireEmailVerification, never half-create sessions on sign-up;
    // unverified sign-in attempts re-send the verification mail instead
    // (emailVerification.sendOnSignIn below).
    autoSignIn: false,
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
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request?: Request) => {
      const path = request ? new URL(request.url).pathname : "";
      const type = path.endsWith("/change-email")
        ? "change-email"
        : "verification";
      await sendRateLimitedAuthEmail(
        {
          type,
          to: user.email,
        },
        () => sendVerificationEmail(user.email, buildVerificationUrl(url)),
      );
    },
    // Runs after ANY successful email verification — both first-time
    // verification and the final step of the change-email flow. Only the
    // latter should trigger the "your email address has been changed" notice,
    // and only AFTER the change has actually been applied, so we detect it
    // from the token's requestType and notify the OLD address (the token's
    // `email` claim) — that's the owner who needs to know if the change was
    // not theirs.
    afterEmailVerification: async (user, request) => {
      const payload = parseVerificationTokenPayload(request);
      if (payload?.requestType !== "change-email-verification") return;
      await sendRateLimitedAuthEmail(
        {
          type: "email-changed-notice",
          to: payload.email,
        },
        () => sendEmailChangedEmail(payload.email, user.email),
      );
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
    },
  },

  user: {
    // Two-step change-email flow (all our users are verified, because
    // requireEmailVerification is on and sign-up never creates a session):
    //   1. POST /change-email → Better Auth calls sendChangeEmailConfirmation
    //      with an approval link, which we email to the CURRENT address.
    //   2. Clicking it → Better Auth sends the standard verification email to
    //      the NEW address via emailVerification.sendVerificationEmail above.
    //   3. Clicking that updates the email; the "your email was changed"
    //      notice then goes out from emailVerification.afterEmailVerification.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendRateLimitedAuthEmail(
          {
            type: "change-email-approval",
            to: user.email,
          },
          () => sendEmailChangeApprovalEmail(user.email, newEmail, url),
        );
      },
    },
    // Self-service account deletion via Better Auth's built-in /delete-user
    // endpoint. Because account deletion is terminal and destructive, we require
    // an emailed confirmation link for everyone (a deliberate second factor):
    // calling /delete-user never deletes inline — it emails a one-time link, and
    // deletion only happens when the user opens `/delete-user/callback?token=…`.
    // Credential users must also pass their password (verified before the email
    // is sent). Better Auth handles token issuance/verification, deletes the
    // user row, revokes all sessions, removes accounts and clears the cookie.
    // The app-specific cascade cleanup runs in `databaseHooks.user.delete.before`
    // (below) so it covers both this flow and admin-initiated removal.
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendRateLimitedAuthEmail(
          {
            type: "delete-account",
            to: user.email,
          },
          () => sendDeleteAccountVerificationEmail(user.email, url),
        );
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    // Opt into better-auth's deferred-refresh protocol: GET /get-session is a
    // pure read (no session-table write on the hot path); the client rolls the
    // session via an explicit POST when the response says needsRefresh.
    // Upstream defaults this OFF only for backward compatibility with clients
    // that never POST — ours is better-auth's own client, which handles it.
    // Keep this on; removing it reverts to a DB write on every session read
    // past updateAge.
    deferSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
      strategy: "jwe",
    },
  },

  advanced: {
    ipAddress: {
      // The edge proxy (the template's published proxy image — see the proxy
      // section of DEPLOYMENT.md) overwrites X-Real-IP and X-Forwarded-For
      // with the resolved client IP, so these are trustworthy.
      ipAddressHeaders: ["x-real-ip", "x-forwarded-for"],
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customStorage: betterAuthRateLimitStorage,
    // Better Auth uses `window` as seconds and `max` as the request count
    // allowed within that window for the matched auth route.
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 10 * 60, max: 3 },
      "/send-verification-email": { window: 10 * 60, max: 3 },
      "/delete-user": { window: 60 * 60, max: 5 },
    },
  },

  databaseHooks: {
    user: {
      delete: {
        // Runs immediately before any user row deleted through Better Auth —
        // covers BOTH the self-service /delete-user (callback) flow and admin
        // removal. The cron unverified-account sweep (apps/cron/src/cleanup.ts
        // Step 3) deletes user rows directly and BYPASSES this hook. Throwing
        // aborts the deletion. Handles the cleanup the FK cascade can't (see
        // the service).
        async before(user) {
          await deleteAccountData(user.id);
        },
      },
    },
  },

  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
      // Setting `endpoints` replaces Better Auth's defaults, so keep the
      // default protected auth routes and add direct verification resends.
      endpoints: [
        "/sign-up/email",
        "/sign-in/email",
        "/request-password-reset",
        "/send-verification-email",
      ],
    }),
    haveIBeenPwned(),
    admin(),
    username(),
    ...(isDev ? [openAPI()] : []),
    ...(isTest ? [testUtils({ captureOTP: true })] : []),
  ],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as Record<string, unknown>;

        // Validate email domain (disposable email blocking + MX check)
        const email = body?.email;
        if (email) {
          const result = await validateEmailDomain(email as string);
          if (!result.valid) {
            throw new APIError("BAD_REQUEST", {
              message: result.reason || "Invalid email address",
            });
          }
        }

        // Check username availability (prevent DB constraint error)
        const username = body?.username;
        if (username && typeof username === "string") {
          const normalized = username.toLowerCase();
          const existing = await db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.username, normalized))
            .limit(1);
          if (existing.length > 0) {
            throw new APIError("UNPROCESSABLE_ENTITY", {
              message: "Username is already taken",
            });
          }
        }
      }
    }),
  },
});
