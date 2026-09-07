import { createHash } from "crypto";
import type { BetterAuthRateLimitStorage } from "better-auth";
import type Redis from "ioredis";
import {
  RateLimiterMemory,
  RateLimiterRedis,
  type RateLimiterAbstract,
  type RateLimiterRes,
} from "rate-limiter-flexible";
import { tooManyRequests } from "./errors.js";
import { getRedisClient } from "./redis.js";

/**
 * Centralized, Redis-backed rate limiting.
 *
 * Policies are declared once in RATE_LIMIT_POLICIES and enforced through the
 * consume/check/refund primitives below. Limits are shared across instances
 * via Redis when REDIS_URL is set; without it (or during a Redis outage) each
 * instance degrades to per-process in-memory limiting instead of failing
 * requests. Keys that contain PII (emails, IPs) are SHA-256 hashed before
 * they are used as Redis keys.
 */

export type RateLimitDimension = "email" | "user" | "ip";

export interface RateLimitPolicy {
  id: string;
  points: number;
  durationSeconds: number;
  dimensions: readonly RateLimitDimension[];
  description: string;
}

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;
const REDIS_PREFIX = "app:rl";
const BETTER_AUTH_RATE_LIMIT_PREFIX = `${REDIS_PREFIX}:better-auth`;
const REDIS_COMMAND_TIMEOUT_MS = 500;

function isTruthyEnv(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

/**
 * Dev/test-only escape hatch: set RATE_LIMITS_DISABLED=true to bypass all
 * application rate limits. Hard-disabled in production so a leaked env var
 * can never turn limits off where it matters.
 */
export function areRateLimitsBypassed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return isTruthyEnv(process.env.RATE_LIMITS_DISABLED);
}

export const RATE_LIMIT_POLICIES = [
  {
    id: "email-send-target-hour",
    points: 3,
    durationSeconds: HOUR,
    dimensions: ["email"],
    description: "Outbound auth emails per target email per hour",
  },
  {
    id: "email-send-target-day",
    points: 5,
    durationSeconds: DAY,
    dimensions: ["email"],
    description: "Outbound auth emails per target email per day",
  },
  {
    // Example policy for capping abuse on public endpoints. Pair it with the
    // ipRateLimit middleware factory (middleware/ip-rate-limit.ts) and add
    // one policy per endpoint family as your API grows.
    id: "public-endpoint-ip-hour",
    points: 120,
    durationSeconds: HOUR,
    dimensions: ["ip"],
    description: "Public endpoint requests per IP per hour",
  },
] as const satisfies readonly RateLimitPolicy[];

const policiesById: Map<string, RateLimitPolicy> = new Map(
  RATE_LIMIT_POLICIES.map((policy) => [policy.id, policy]),
);

interface LimiterEntry {
  limiter: RateLimiterAbstract;
  memoryLimiter: RateLimiterMemory;
  redis: Redis | null;
}

let limiterEntries = new Map<string, LimiterEntry>();
let betterAuthConsumeMemory = new Map<
  string,
  { count: number; resetAt: number }
>();

export class RateLimitError extends Error {
  readonly status = 429;

  constructor(
    readonly policy: RateLimitPolicy,
    readonly key: string,
    readonly result: RateLimiterRes,
  ) {
    super(`${policy.description} exceeded`);
    this.name = "RateLimitError";
  }
}

function getRateLimitPolicy(policyId: string): RateLimitPolicy {
  const policy = policiesById.get(policyId);
  if (!policy) throw new Error(`Unknown rate-limit policy: ${policyId}`);
  return policy;
}

function policyKeyPrefix(policyId: string): string {
  return `${REDIS_PREFIX}:${policyId}`;
}

function getLimiterEntry(policy: RateLimitPolicy): LimiterEntry {
  const existing = limiterEntries.get(policy.id);
  if (existing) return existing;

  const options = {
    keyPrefix: policyKeyPrefix(policy.id),
    points: policy.points,
    duration: policy.durationSeconds,
  };
  const memoryLimiter = new RateLimiterMemory(options);
  const redis = getRedisClient();

  if (!redis) {
    const entry = { limiter: memoryLimiter, memoryLimiter, redis: null };
    limiterEntries.set(policy.id, entry);
    return entry;
  }

  const limiter = new RateLimiterRedis({
    ...options,
    storeClient: redis,
    insuranceLimiter: memoryLimiter,
    rejectIfRedisNotReady: true,
  });
  const entry = { limiter, memoryLimiter, redis };
  limiterEntries.set(policy.id, entry);
  return entry;
}

function isRateLimiterResponse(value: unknown): value is RateLimiterRes {
  return (
    typeof value === "object" &&
    value !== null &&
    "msBeforeNext" in value &&
    "remainingPoints" in value &&
    "consumedPoints" in value
  );
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return err instanceof RateLimitError;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashRateLimitValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function makeRateLimitKey(
  dimension: RateLimitDimension,
  value: string,
): string {
  switch (dimension) {
    case "email":
      return `email:${hashRateLimitValue(normalizeEmail(value))}`;
    case "user":
      return `user:${value.trim()}`;
    case "ip":
      return `ip:${hashRateLimitValue(value.trim())}`;
  }
}

/**
 * Counter keyspace for the atomic `consume` path. The `:c:` segment keeps
 * these counters distinct from the JSON records the retired `get`/`set`
 * contract (better-auth < 1.7) wrote under the bare prefix, which may linger
 * in Redis until their TTL expires; it must not change, or live windows reset
 * on deploy.
 */
function betterAuthConsumeKey(key: string): string {
  return `${BETTER_AUTH_RATE_LIMIT_PREFIX}:c:${key}`;
}

/**
 * Fixed-window counter, executed atomically server-side: INCR the counter,
 * start the window TTL when the counter is new (and self-heal a missing TTL,
 * e.g. after a partial failure), and report the count plus remaining window.
 * Returns [count, pttlMillis].
 */
const BETTER_AUTH_CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1]) * 1000
end
return {count, ttl}
`;

interface ConsumeRule {
  window: number;
  max: number;
}

interface ConsumeResult {
  allowed: boolean;
  retryAfter: number | null;
}

/**
 * In-process fixed-window counter mirroring the Redis consume script, used
 * when Redis is unset or a command fails/times out. Synchronous, so it is
 * strict even under concurrent requests within this instance.
 */
// The fallback map otherwise grows by one entry per distinct ip|path for the
// life of the process (no Redis in dev, or a long Redis outage in
// production). Sweep expired windows once it gets big; better-auth's own
// memory storage prunes on every consume for the same reason.
const BETTER_AUTH_MEMORY_PRUNE_THRESHOLD = 10_000;

function pruneBetterAuthMemory(now: number): void {
  for (const [key, entry] of betterAuthConsumeMemory) {
    if (now >= entry.resetAt) betterAuthConsumeMemory.delete(key);
  }
}

/** Test-only visibility into the fallback map's size. */
export function betterAuthMemorySizeForTests(): number {
  return betterAuthConsumeMemory.size;
}

function consumeBetterAuthMemory(
  key: string,
  rule: ConsumeRule,
): ConsumeResult {
  const now = Date.now();
  const entry = betterAuthConsumeMemory.get(key);
  if (!entry || now >= entry.resetAt) {
    if (
      !entry &&
      betterAuthConsumeMemory.size >= BETTER_AUTH_MEMORY_PRUNE_THRESHOLD
    ) {
      pruneBetterAuthMemory(now);
    }
    betterAuthConsumeMemory.set(key, {
      count: 1,
      resetAt: now + rule.window * 1000,
    });
    return { allowed: true, retryAfter: null };
  }
  entry.count += 1;
  if (entry.count <= rule.max) {
    return { allowed: true, retryAfter: null };
  }
  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function withRedisTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Redis command timed out"));
    }, REDIS_COMMAND_TIMEOUT_MS);

    operation
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

/**
 * Redis-backed storage for better-auth's built-in rate limiter, replacing
 * `storage: "database"` (which wrote a Postgres row per counted auth
 * request). Implements the `consume` contract (better-auth >= 1.7 dropped the
 * legacy `get`/`set` members): an atomic single-step check-and-increment,
 * strict under concurrent bursts. Falls back to an in-process counter when
 * Redis is unset or a command fails/times out, so auth keeps working through
 * a Redis outage.
 */
export const betterAuthRateLimitStorage: BetterAuthRateLimitStorage = {
  async consume(key, rule) {
    const redis = getRedisClient();
    if (!redis) return consumeBetterAuthMemory(key, rule);

    try {
      const raw: unknown = await withRedisTimeout(
        redis.eval(
          BETTER_AUTH_CONSUME_SCRIPT,
          1,
          betterAuthConsumeKey(key),
          String(rule.window),
        ),
      );
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error("Unexpected consume script result");
      }
      const count = Number(raw[0]);
      const ttlMs = Number(raw[1]);
      if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
        throw new Error("Unexpected consume script result");
      }
      if (count <= rule.max) {
        return { allowed: true, retryAfter: null };
      }
      return {
        allowed: false,
        retryAfter: Math.max(
          1,
          Math.ceil((ttlMs > 0 ? ttlMs : rule.window * 1000) / 1000),
        ),
      };
    } catch (err) {
      console.error("[rate-limit] Better Auth Redis consume failed:", err);
      return consumeBetterAuthMemory(key, rule);
    }
  },
};

async function consumeRateLimit(policyId: string, key: string): Promise<void> {
  if (areRateLimitsBypassed()) return;

  const policy = getRateLimitPolicy(policyId);
  const entry = getLimiterEntry(policy);

  try {
    await entry.limiter.consume(key);
  } catch (err) {
    if (isRateLimiterResponse(err)) {
      // A rejected consume still increments the counter; refund it so
      // hammering a limited endpoint can't push the retry time out forever.
      if (err.consumedPoints > policy.points) {
        try {
          await entry.limiter.reward(key);
        } catch (refundErr) {
          console.error(
            "[rate-limit] Failed to refund rejected consume:",
            refundErr,
          );
        }
      }
      throw new RateLimitError(policy, key, err);
    }
    throw err;
  }
}

async function checkRateLimit(policyId: string, key: string): Promise<void> {
  if (areRateLimitsBypassed()) return;

  const policy = getRateLimitPolicy(policyId);
  const entry = getLimiterEntry(policy);
  const result = await entry.limiter.get(key);

  if (
    result &&
    result.msBeforeNext > 0 &&
    result.consumedPoints >= policy.points
  ) {
    throw new RateLimitError(policy, key, result);
  }
}

async function refundRateLimit(policyId: string, key: string): Promise<void> {
  if (areRateLimitsBypassed()) return;

  const policy = getRateLimitPolicy(policyId);
  const entry = getLimiterEntry(policy);
  await entry.limiter.reward(key);
}

/**
 * A paired daily + hourly quota: both are probed first so an exhausted hour
 * never burns a day point, then the day is consumed and the hour consumed
 * or, if it fails, the day point refunded (best-effort, logged).
 */
async function consumeDayHourQuota(
  dayPolicyId: string,
  hourPolicyId: string,
  key: string,
  label: string,
): Promise<void> {
  await checkRateLimit(dayPolicyId, key);
  await checkRateLimit(hourPolicyId, key);

  await consumeRateLimit(dayPolicyId, key);
  try {
    await consumeRateLimit(hourPolicyId, key);
  } catch (err) {
    try {
      await refundRateLimit(dayPolicyId, key);
    } catch (refundErr) {
      console.error(
        `[rate-limit] Failed to refund daily ${label} quota:`,
        refundErr,
      );
    }
    throw err;
  }
}

/**
 * Per-recipient cap on outbound auth emails (verification, password reset,
 * change-email, delete-account). Dual-window: consume the day bucket first,
 * then the hour bucket, refunding the day bucket if the hour bucket rejects
 * so a burst doesn't double-count against the day quota.
 */
export async function consumeEmailSendLimit(to: string): Promise<void> {
  const key = makeRateLimitKey("email", to);
  await consumeDayHourQuota(
    "email-send-target-day",
    "email-send-target-hour",
    key,
    "email",
  );
}

/**
 * Example per-IP consumer for public endpoints. Add one exported consumer
 * per policy so call sites never handle raw policy ids or key building.
 */
export async function consumePublicEndpointLimit(ip: string): Promise<void> {
  const key = makeRateLimitKey("ip", ip);
  await consumeRateLimit("public-endpoint-ip-hour", key);
}

/**
 * The route envelope for quota consumption: runs `consume` and turns a
 * RateLimitError into the 429 with the human-readable reason; anything else
 * propagates. Takes a callback (rather than a policy) so route tests can keep
 * stubbing the individual consume functions.
 */
export async function rateLimitedOr429(
  consume: () => Promise<void>,
): Promise<void> {
  try {
    await consume();
  } catch (err) {
    if (isRateLimitError(err))
      throw tooManyRequests(formatRateLimitReason(err));
    throw err;
  }
}

export function formatRateLimitReason(error: RateLimitError): string {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(error.result.msBeforeNext / 1000),
  );
  const consumed = Math.min(error.result.consumedPoints, error.policy.points);
  return `${error.policy.description} exceeded (${consumed}/${error.policy.points}). Try again in ${retryAfterSeconds} seconds.`;
}

export function resetRateLimitersForTests(): void {
  limiterEntries = new Map();
  betterAuthConsumeMemory = new Map();
}
