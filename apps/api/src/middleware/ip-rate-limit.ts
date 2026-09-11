import { createMiddleware } from "hono/factory";
import {
  consumePublicEndpointLimit,
  rateLimitedOr429,
} from "../lib/rate-limits.js";

type BunServerLike = {
  requestIP?: (req: Request) => { address: string } | null;
};

// Best-effort client IP. We trust `x-real-ip` first (our edge proxy — the
// template's published proxy image — overwrites it with the resolved client
// address on every request), then fall back to the RIGHT-most
// `x-forwarded-for` entry — that one was appended by the nearest proxy hop,
// while left-hand entries are client-supplied and spoofable — then to Bun's
// per-request socket address. If nothing is available we use a single shared
// bucket so an attacker can't strip headers to evade the limit.
function extractClientIp(
  headers: Headers,
  server: BunServerLike | undefined,
  request: Request,
): string {
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const last = forwardedFor.split(",").at(-1)?.trim();
    if (last) return last;
  }

  const conn = server?.requestIP?.(request);
  if (conn?.address) return conn.address;

  return "unknown";
}

/**
 * Middleware factory: put a per-IP abuse cap on any endpoint by pairing it
 * with a consumer from lib/rate-limits.ts. Converts RateLimitError into a
 * 429 with a human-readable retry-after message.
 *
 *   app.post("/api/feedback", publicEndpointRateLimit, handler);
 */
export function ipRateLimit(consume: (ip: string) => Promise<void>) {
  return createMiddleware(async (c, next) => {
    // Under Bun.serve, the server instance is passed as fetch's second
    // argument, which Hono surfaces as `c.env`.
    const server = c.env as BunServerLike | undefined;
    const ip = extractClientIp(c.req.raw.headers, server, c.req.raw);

    await rateLimitedOr429(() => consume(ip));
    await next();
  });
}

// Example instance backed by the `public-endpoint-ip-hour` policy. Add one
// instance per policy as you add public endpoints.
export const publicEndpointRateLimit = ipRateLimit(consumePublicEndpointLimit);
