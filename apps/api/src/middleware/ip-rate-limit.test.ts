import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RateLimiterRes } from "rate-limiter-flexible";
import {
  RATE_LIMIT_POLICIES,
  RateLimitError,
  formatRateLimitReason,
} from "../lib/rate-limits.js";
import { ipRateLimit } from "./ip-rate-limit.js";

const POLICY = RATE_LIMIT_POLICIES.find(
  (policy) => policy.id === "public-endpoint-ip-hour",
)!;

/** Mounts the middleware on a throwaway app and exposes the error it saw. */
function buildApp(consume: (ip: string) => Promise<void>) {
  const app = new Hono();
  let lastError: unknown = null;
  app.onError((err, c) => {
    lastError = err;
    if (err instanceof HTTPException) return err.getResponse();
    return c.text("boom", 500);
  });
  app.get("/limited", ipRateLimit(consume), (c) => c.text("ok"));
  return { app, getLastError: () => lastError };
}

/** The IP the middleware resolved for a request with `headers` (and `env`,
 *  which is what Bun.serve passes as fetch's second argument). */
async function resolvedIp(
  headers: Record<string, string>,
  env?: unknown,
): Promise<string> {
  const seen: string[] = [];
  const { app } = buildApp(async (ip) => {
    seen.push(ip);
  });
  const res = await app.request("/limited", { headers }, env);
  expect(res.status).toBe(200);
  return seen[0]!;
}

describe("client IP resolution", () => {
  test("prefers x-real-ip over x-forwarded-for", async () => {
    expect(
      await resolvedIp({
        "x-real-ip": " 203.0.113.7 ",
        "x-forwarded-for": "1.1.1.1, 10.0.0.5",
      }),
    ).toBe("203.0.113.7");
  });

  test("uses the RIGHT-most x-forwarded-for entry (nearest proxy hop)", async () => {
    expect(await resolvedIp({ "x-forwarded-for": "1.1.1.1, 10.0.0.5" })).toBe(
      "10.0.0.5",
    );
    expect(
      await resolvedIp({ "x-forwarded-for": " 1.1.1.1 ,  10.0.0.5 " }),
    ).toBe("10.0.0.5");
    expect(await resolvedIp({ "x-forwarded-for": "198.51.100.9" })).toBe(
      "198.51.100.9",
    );
  });

  test("falls back to Bun's per-request socket address", async () => {
    expect(
      await resolvedIp({}, { requestIP: () => ({ address: "9.9.9.9" }) }),
    ).toBe("9.9.9.9");
  });

  test("uses a single shared bucket when nothing is available", async () => {
    expect(await resolvedIp({})).toBe("unknown");
    expect(await resolvedIp({ "x-forwarded-for": " , " })).toBe("unknown");
  });
});

describe("ipRateLimit", () => {
  test("maps a RateLimitError to a 429 with the human-readable reason", async () => {
    const error = new RateLimitError(
      POLICY,
      "ip:abc",
      new RateLimiterRes(0, 30_000, POLICY.points + 1),
    );
    const { app } = buildApp(async () => {
      throw error;
    });

    const res = await app.request("/limited");

    expect(res.status).toBe(429);
    expect(await res.text()).toContain(formatRateLimitReason(error));
  });

  test("lets any other error propagate untouched", async () => {
    const boom = new Error("redis exploded");
    const { app, getLastError } = buildApp(async () => {
      throw boom;
    });

    const res = await app.request("/limited");

    expect(res.status).toBe(500);
    expect(getLastError()).toBe(boom);
  });
});
