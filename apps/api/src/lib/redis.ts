import Redis from "ioredis";
import { injectTraceContext, SpanKind, withSpan } from "@app/otel";
import type { RealtimeMessage } from "@app/shared";
import { errorLogValue, logger } from "./logger.js";

const redisUrl = process.env.REDIS_URL;

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is required");
    }
    publisher = new Redis(redisUrl);
    publisher.on("error", (err: Error) =>
      logger.error("redis.publisher_connection_error", {
        error: errorLogValue(err),
      }),
    );
  }
  return publisher;
}

export function getRedisClient(): Redis | null {
  if (!redisUrl) {
    return null;
  }
  return getPublisher();
}

/**
 * Publishes a backplane envelope to every WS instance subscribed to `topic`,
 * inside a PRODUCER span. The active trace context rides along as an additive
 * `_otel` field so the WS service can continue the same trace when it acts on
 * the message; consumers switch on `kind` and ignore it.
 */
function publishRealtime(topic: string, message: RealtimeMessage): void {
  void withSpan(
    "redis.publish",
    async () => {
      const envelope = { ...message, _otel: injectTraceContext() };
      await getPublisher().publish(topic, JSON.stringify(envelope));
    },
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        "messaging.system": "redis",
        "messaging.destination.name": topic,
        "messaging.operation": "publish",
        "ws.message.kind": message.kind,
      },
    },
  ).catch((err: Error) => {
    // Deliberately fire-and-forget — a mutation must not fail because its
    // broadcast did. But a dropped publish means every connected client is
    // now stale until their next reconnect/refetch, so make the failure
    // findable: structured log with the topic, envelope kind and event type
    // (the span above already carries the error for tracing).
    const eventType =
      message.kind === "event" &&
      message.data &&
      typeof message.data === "object" &&
      "type" in message.data
        ? String((message.data as { type: unknown }).type)
        : undefined;
    logger.error("redis.publish_failed", {
      topic,
      kind: message.kind,
      eventType,
      error: errorLogValue(err),
    });
  });
}

/** Fan `data` out to every client subscribed to `topic`, on all WS instances. */
export function publishEvent(topic: string, data: unknown): void {
  publishRealtime(topic, { kind: "event", data });
}

/**
 * Close every socket belonging to `userId` that is subscribed to `topic`,
 * across all WS instances (close code 4001 — clients will not auto-reconnect).
 * Use when a user is removed, banned, or their session is force-ended.
 */
export function publishDisconnectUser(topic: string, userId: string): void {
  publishRealtime(topic, { kind: "disconnect-user", userId });
}

/**
 * Makes every WS instance re-run subscription authorization (via
 * /api/ws/authorize) for each of its subscribers of `topic`, dropping the
 * ones whose access was revoked. Call after a permission change so
 * subscribe-time authorization doesn't outlive the access it checked.
 */
export function publishRevalidateTopic(topic: string): void {
  publishRealtime(topic, { kind: "revalidate-topic" });
}
