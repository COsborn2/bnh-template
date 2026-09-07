import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";
import { betterAuth } from "better-auth";
import Redis from "ioredis";
import { redisStub } from "../test-support/mocks.js";

// Switchable Redis mock: null (the default) exercises the in-memory fallback
// paths; the redis-specific tests below temporarily point it at a real client
// when REDIS_URL is available.
let mockRedisClient: Redis | null = null;

mock.module("./redis.js", () =>
  redisStub({ getRedisClient: () => mockRedisClient }),
);

import {
  RATE_LIMIT_POLICIES,
  RateLimitError,
  areRateLimitsBypassed,
  betterAuthMemorySizeForTests,
  betterAuthRateLimitStorage,
  consumeEmailSendLimit,
  consumePublicEndpointLimit,
  formatRateLimitReason,
  makeRateLimitKey,
  resetRateLimitersForTests,
} from "./rate-limits.js";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  RATE_LIMITS_DISABLED: process.env.RATE_LIMITS_DISABLED,
};

beforeEach(() => {
  resetRateLimitersForTests();
  mockRedisClient = null;
  delete process.env.RATE_LIMITS_DISABLED;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  resetRateLimitersForTests();
  if (ORIGINAL_ENV.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  }
  if (ORIGINAL_ENV.RATE_LIMITS_DISABLED === undefined) {
    delete process.env.RATE_LIMITS_DISABLED;
  } else {
    process.env.RATE_LIMITS_DISABLED = ORIGINAL_ENV.RATE_LIMITS_DISABLED;
  }
});

describe("rate limit key normalization", () => {
  test("normalizes and hashes email keys", () => {
    const first = makeRateLimitKey("email", " Person@Example.COM ");
    const second = makeRateLimitKey("email", "person@example.com");

    expect(first).toBe(second);
    expect(first).toMatch(/^email:[0-9a-f]{64}$/);
    expect(first).not.toContain("person@example.com");
  });

  test("hashes ip keys so raw addresses never reach Redis", () => {
    const key = makeRateLimitKey("ip", "203.0.113.7");

    expect(key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
  });

  test("uses raw user keys", () => {
    expect(makeRateLimitKey("user", "user-1")).toBe("user:user-1");
  });
});

describe("policy registry", () => {
  test("contains the email-send and public-endpoint policies", () => {
    const byId = new Map(
      RATE_LIMIT_POLICIES.map((policy) => [policy.id, policy]),
    );

    expect(byId.get("email-send-target-hour")?.points).toBe(3);
    expect(byId.get("email-send-target-hour")?.dimensions).toEqual(["email"]);
    expect(byId.get("email-send-target-day")?.points).toBe(5);
    expect(byId.get("email-send-target-day")?.dimensions).toEqual(["email"]);
    expect(byId.get("public-endpoint-ip-hour")?.points).toBe(120);
    expect(byId.get("public-endpoint-ip-hour")?.dimensions).toEqual(["ip"]);
    expect(RATE_LIMIT_POLICIES).toHaveLength(3);
  });
});

describe("rate limit consumption", () => {
  test("can bypass application rate limits outside production", async () => {
    process.env.NODE_ENV = "development";
    process.env.RATE_LIMITS_DISABLED = "true";

    expect(areRateLimitsBypassed()).toBe(true);
    for (let i = 0; i < 20; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }
  });

  test("enforces rate limits by default outside production", async () => {
    process.env.NODE_ENV = "development";

    expect(areRateLimitsBypassed()).toBe(false);
    for (let i = 0; i < 3; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }
    await expect(
      consumeEmailSendLimit("person@example.com"),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  test("production ignores RATE_LIMITS_DISABLED", async () => {
    process.env.NODE_ENV = "production";
    process.env.RATE_LIMITS_DISABLED = "true";

    expect(areRateLimitsBypassed()).toBe(false);
    for (let i = 0; i < 3; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }
    await expect(
      consumeEmailSendLimit("person@example.com"),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  test("uses memory fallback for public endpoint limits when Redis is unavailable", async () => {
    for (let i = 0; i < 120; i += 1) {
      await consumePublicEndpointLimit("203.0.113.7");
    }

    try {
      await consumePublicEndpointLimit("203.0.113.7");
      throw new Error("Expected public endpoint rate limit to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      if (err instanceof RateLimitError) {
        expect(err.policy.id).toBe("public-endpoint-ip-hour");
      }
    }

    // A different IP has its own bucket.
    await consumePublicEndpointLimit("203.0.113.8");
  });

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

  test("does not keep incrementing counters for rejected consumes", async () => {
    for (let i = 0; i < 3; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }

    for (let i = 0; i < 2; i += 1) {
      try {
        await consumeEmailSendLimit("person@example.com");
        throw new Error("Expected target email rate limit to reject");
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        if (err instanceof RateLimitError) {
          expect(formatRateLimitReason(err)).toContain("(3/3)");
          expect(err.result.consumedPoints).toBe(3);
        }
      }
    }
  });

  test("refunds the day bucket when the hour bucket rejects", async () => {
    // Exhaust the hour bucket (3/hr) without touching the day cap (5/day).
    for (let i = 0; i < 3; i += 1) {
      await consumeEmailSendLimit("person@example.com");
    }

    // Each rejected attempt must be charged against the hour window only —
    // the day bucket stays at 3 consumed, and the failure policy is always
    // the hour policy, never the day policy.
    for (let i = 0; i < 4; i += 1) {
      try {
        await consumeEmailSendLimit("person@example.com");
        throw new Error("Expected target email rate limit to reject");
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError);
        if (err instanceof RateLimitError) {
          expect(err.policy.id).toBe("email-send-target-hour");
        }
      }
    }
  });
});

describe("Better Auth rate limit consume (memory fallback)", () => {
  const consume = (key: string, rule: { window: number; max: number }) =>
    betterAuthRateLimitStorage.consume(key, rule);

  test("evicts expired windows once the map is large", async () => {
    const rule = { window: 10, max: 3 };
    try {
      for (let i = 0; i < 10_000; i += 1) {
        await consume(`203.0.113.${i}|/sign-in/email`, rule);
      }
      expect(betterAuthMemorySizeForTests()).toBe(10_000);

      setSystemTime(new Date(Date.now() + 11_000));
      await consume("fresh|/sign-in/email", rule);

      // Every earlier window has elapsed; only the new key survives.
      expect(betterAuthMemorySizeForTests()).toBe(1);
    } finally {
      setSystemTime();
    }
  });

  test("allows up to max requests then blocks with a retryAfter", async () => {
    const rule = { window: 10, max: 3 };

    for (let i = 0; i < 3; i += 1) {
      await expect(consume("127.0.0.1|/sign-in/email", rule)).resolves.toEqual({
        allowed: true,
        retryAfter: null,
      });
    }

    const blocked = await consume("127.0.0.1|/sign-in/email", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfter).toBeLessThanOrEqual(10);

    // A different key has its own counter.
    await expect(consume("203.0.113.7|/sign-in/email", rule)).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
  });

  test("is strict under concurrent bursts", async () => {
    const rule = { window: 10, max: 3 };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => consume("127.0.0.1|/sign-in/email", rule)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  test("opens a fresh window after the previous one elapses", async () => {
    const rule = { window: 10, max: 2 };

    try {
      await consume("k", rule);
      await consume("k", rule);
      const blocked = await consume("k", rule);
      expect(blocked.allowed).toBe(false);

      setSystemTime(new Date(Date.now() + 11_000));

      await expect(consume("k", rule)).resolves.toEqual({
        allowed: true,
        retryAfter: null,
      });
    } finally {
      setSystemTime();
    }
  });
});

describe("Better Auth rate limit consume (redis)", () => {
  test.skipIf(!process.env.REDIS_URL)(
    "atomically enforces the limit under parallel bursts and sets a TTL",
    async () => {
      const client = new Redis(process.env.REDIS_URL!);
      const key = `consume-redis-test-${Date.now()}`;
      const counterKey = `app:rl:better-auth:c:${key}`;

      try {
        mockRedisClient = client;
        const rule = { window: 60, max: 3 };

        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            betterAuthRateLimitStorage.consume(key, rule),
          ),
        );

        expect(results.filter((result) => result.allowed)).toHaveLength(3);
        const blocked = results.find((result) => !result.allowed);
        expect(blocked?.retryAfter).toBeGreaterThanOrEqual(1);
        expect(blocked?.retryAfter).toBeLessThanOrEqual(60);

        // The counter key must expire on its own once the window ends.
        const ttl = await client.ttl(counterKey);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(60);
      } finally {
        mockRedisClient = null;
        await client.del(counterKey).catch(() => {});
        client.disconnect();
      }
    },
  );
});

describe("Better Auth route limiter with atomic custom storage", () => {
  test("returns 429 via consume without a best-effort warning", async () => {
    const warnings: string[] = [];
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      basePath: "/api/auth",
      secret: "better-auth-secret-that-is-long-enough-for-test",
      logger: {
        log: (level, message) => {
          if (level === "warn") warnings.push(message);
        },
      },
      rateLimit: {
        enabled: true,
        customStorage: betterAuthRateLimitStorage,
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

    // Default special rule for /send-verification-email: 3 per 60 seconds.
    await expect(
      sendVerificationRequest().then((res) => res.status),
    ).resolves.toBe(200);
    await expect(
      sendVerificationRequest().then((res) => res.status),
    ).resolves.toBe(200);
    await expect(
      sendVerificationRequest().then((res) => res.status),
    ).resolves.toBe(200);

    const blocked = await sendVerificationRequest();

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("x-retry-after")).toBeTruthy();
    expect(warnings.filter((w) => w.includes("best-effort"))).toHaveLength(0);
  });
});
