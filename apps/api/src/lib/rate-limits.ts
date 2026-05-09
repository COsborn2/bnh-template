import { createHash } from "crypto";
import type { BetterAuthRateLimitStorage, RateLimit } from "better-auth";
import type Redis from "ioredis";
import {
  RateLimiterMemory,
  RateLimiterRedis,
  type RateLimiterAbstract,
  type RateLimiterRes,
} from "rate-limiter-flexible";
import { getRedisClient } from "./redis.js";

export type RateLimitDimension = "email";

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
const BETTER_AUTH_RATE_LIMIT_TTL_SECONDS = DAY;
const BETTER_AUTH_RATE_LIMIT_PREFIX = `${REDIS_PREFIX}:better-auth`;
const REDIS_COMMAND_TIMEOUT_MS = 500;

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
let betterAuthRateLimitMemory = new Map<
  string,
  { value: RateLimit; expiresAt: number }
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
  if (dimension === "email") {
    return `email:${hashRateLimitValue(normalizeEmail(value))}`;
  }

  throw new Error(`Unsupported rate-limit dimension: ${dimension}`);
}

function betterAuthRateLimitKey(key: string): string {
  return `${BETTER_AUTH_RATE_LIMIT_PREFIX}:${key}`;
}

function isBetterAuthRateLimit(value: unknown): value is RateLimit {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "count" in value &&
    "lastRequest" in value &&
    typeof value.key === "string" &&
    typeof value.count === "number" &&
    typeof value.lastRequest === "number"
  );
}

function readBetterAuthMemory(key: string): RateLimit | null {
  const entry = betterAuthRateLimitMemory.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    betterAuthRateLimitMemory.delete(key);
    return null;
  }
  return entry.value;
}

function writeBetterAuthMemory(key: string, value: RateLimit): void {
  betterAuthRateLimitMemory.set(key, {
    value,
    expiresAt: Date.now() + BETTER_AUTH_RATE_LIMIT_TTL_SECONDS * 1000,
  });
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

export const betterAuthRateLimitStorage: BetterAuthRateLimitStorage = {
  async get(key) {
    const redis = getRedisClient();
    if (!redis) return readBetterAuthMemory(key);

    try {
      const raw = await withRedisTimeout(redis.get(betterAuthRateLimitKey(key)));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isBetterAuthRateLimit(parsed) ? parsed : null;
    } catch (err) {
      console.error("[rate-limit] Better Auth Redis get failed:", err);
      return readBetterAuthMemory(key);
    }
  },
  async set(key, value) {
    const redis = getRedisClient();
    if (!redis) {
      writeBetterAuthMemory(key, value);
      return;
    }

    try {
      await withRedisTimeout(
        redis.set(
          betterAuthRateLimitKey(key),
          JSON.stringify(value),
          "EX",
          BETTER_AUTH_RATE_LIMIT_TTL_SECONDS,
        ),
      );
    } catch (err) {
      console.error("[rate-limit] Better Auth Redis set failed:", err);
      writeBetterAuthMemory(key, value);
    }
  },
};

async function consumeRateLimit(policyId: string, key: string): Promise<void> {
  const policy = getRateLimitPolicy(policyId);
  const entry = getLimiterEntry(policy);

  try {
    await entry.limiter.consume(key);
  } catch (err) {
    if (isRateLimiterResponse(err)) {
      throw new RateLimitError(policy, key, err);
    }
    throw err;
  }
}

async function checkRateLimit(policyId: string, key: string): Promise<void> {
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
  const policy = getRateLimitPolicy(policyId);
  const entry = getLimiterEntry(policy);
  await entry.limiter.reward(key);
}

export async function consumeEmailSendLimit(to: string): Promise<void> {
  const key = makeRateLimitKey("email", to);
  await checkRateLimit("email-send-target-day", key);
  await checkRateLimit("email-send-target-hour", key);

  await consumeRateLimit("email-send-target-day", key);
  try {
    await consumeRateLimit("email-send-target-hour", key);
  } catch (err) {
    try {
      await refundRateLimit("email-send-target-day", key);
    } catch (refundErr) {
      console.error("[rate-limit] Failed to refund daily email quota:", refundErr);
    }
    throw err;
  }
}

export function formatRateLimitReason(error: RateLimitError): string {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(error.result.msBeforeNext / 1000),
  );
  return `${error.policy.description} exceeded (${error.result.consumedPoints}/${error.policy.points}). Try again in ${retryAfterSeconds} seconds.`;
}

export function resetRateLimitersForTests(): void {
  limiterEntries = new Map();
  betterAuthRateLimitMemory = new Map();
}
