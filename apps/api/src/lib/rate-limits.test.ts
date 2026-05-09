import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  betterAuth,
  type BetterAuthRateLimitStorage,
  type RateLimit,
} from "better-auth";

mock.module("./redis.js", () => ({
  getRedisClient: () => null,
}));

import {
  RATE_LIMIT_POLICIES,
  RateLimitError,
  betterAuthRateLimitStorage,
  consumeEmailSendLimit,
  makeRateLimitKey,
  resetRateLimitersForTests,
} from "./rate-limits.js";

beforeEach(() => {
  resetRateLimitersForTests();
});

describe("rate limit key normalization", () => {
  test("normalizes and hashes email keys", () => {
    const first = makeRateLimitKey("email", " Person@Example.COM ");
    const second = makeRateLimitKey("email", "person@example.com");

    expect(first).toBe(second);
    expect(first).toMatch(/^email:[0-9a-f]{64}$/);
    expect(first).not.toContain("person@example.com");
  });
});

describe("policy registry", () => {
  test("contains target email-send policies", () => {
    const byId = new Map(RATE_LIMIT_POLICIES.map((policy) => [policy.id, policy]));

    expect(byId.get("email-send-target-hour")?.points).toBe(3);
    expect(byId.get("email-send-target-day")?.points).toBe(5);
    expect(RATE_LIMIT_POLICIES).toHaveLength(2);
  });
});

describe("rate limit consumption", () => {
  test("blocks repeated sends to the same target email by hour", async () => {
    for (let i = 0; i < 3; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }

    try {
      await consumeEmailSendLimit("person@example.com");
      throw new Error("Expected target email rate limit to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      if (err instanceof RateLimitError) {
        expect(err.policy.id).toBe("email-send-target-hour");
      }
    }
  });
});

describe("Better Auth rate limit storage", () => {
  test("stores Better Auth route limits in the memory fallback", async () => {
    const value = {
      key: "127.0.0.1|/sign-in/email",
      count: 1,
      lastRequest: Date.now(),
    };

    await betterAuthRateLimitStorage.set(value.key, value);

    await expect(betterAuthRateLimitStorage.get(value.key)).resolves.toEqual(
      value,
    );
  });

  test("updates existing Better Auth route limit records", async () => {
    const key = "127.0.0.1|/sign-up/email";
    const first = { key, count: 1, lastRequest: Date.now() };
    const second = { key, count: 2, lastRequest: first.lastRequest + 1000 };

    await betterAuthRateLimitStorage.set(key, first);
    await betterAuthRateLimitStorage.set(key, second, true);

    await expect(betterAuthRateLimitStorage.get(key)).resolves.toEqual(second);
  });
});

describe("Better Auth route limiter", () => {
  test("returns 429 responses when custom storage reaches the route limit", async () => {
    const records = new Map<string, RateLimit>();
    const storage: BetterAuthRateLimitStorage = {
      get: async (key) => records.get(key),
      set: async (key, value) => {
        records.set(key, value);
      },
    };
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      basePath: "/api/auth",
      secret: "better-auth-secret-that-is-long-enough-for-test",
      rateLimit: {
        enabled: true,
        customStorage: storage,
      },
      advanced: {
        ipAddress: {
          ipAddressHeaders: ["x-real-ip"],
        },
      },
      emailVerification: {
        sendVerificationEmail: async () => {},
      },
    });
    const sendVerificationRequest = () =>
      auth.handler(
        new Request("http://localhost:3000/api/auth/send-verification-email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-real-ip": "127.0.0.1",
          },
          body: JSON.stringify({ email: "nobody@example.com" }),
        }),
      );

    await expect(sendVerificationRequest().then((res) => res.status)).resolves.toBe(
      200,
    );
    await expect(sendVerificationRequest().then((res) => res.status)).resolves.toBe(
      200,
    );
    await expect(sendVerificationRequest().then((res) => res.status)).resolves.toBe(
      200,
    );

    const blocked = await sendVerificationRequest();

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      message: "Too many requests. Please try again later.",
    });
    expect(blocked.headers.get("x-retry-after")).toBeTruthy();
    expect(records.get("127.0.0.1|/send-verification-email")?.count).toBe(3);
  });
});
