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
import { sendVerificationEmail, sendPasswordResetEmail } from "@app/email";
import { validateEmailDomain } from "../services/email-validation.js";
import { eq } from "drizzle-orm";
import { user as userTable } from "@app/db/schema";

const isTest = process.env.NODE_ENV === "test";
const isDev = process.env.NODE_ENV !== "production";

/** Ensure the verification URL always redirects to /dashboard after verification. */
export function buildVerificationUrl(url: string): string {
  const verifyUrl = new URL(url);
  verifyUrl.searchParams.set("callbackURL", "/dashboard");
  return verifyUrl.toString();
}

export const auth = betterAuth({
  appName: process.env.APP_NAME || "MyApp",
  baseURL: process.env.BETTER_AUTH_URL,
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
      void sendPasswordResetEmail(user.email, url);
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
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail(user.email, buildVerificationUrl(url));
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
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    deferSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
      strategy: "jwe",
    },
  },

  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },

  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
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
