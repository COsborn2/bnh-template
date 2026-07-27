import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is required");
}

/** Host only — the full URL carries credentials and must stay out of logs. */
function describeRedisTarget(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "configured Redis";
  }
}

console.log(`[redis] connecting to ${describeRedisTarget(redisUrl)}`);

const redisOptions = {
  retryStrategy(times: number) {
    const delay = Math.min(times * 500, 5000);
    if (times === 1) {
      console.error(
        `[redis] connection failed — is Redis running? (retrying every ${delay / 1000}s)`
      );
    }
    return delay;
  },
  // Required for subscribe mode — null means "retry forever" (ioredis types require this cast)
  maxRetriesPerRequest: null as unknown as number,
};

/** Subscriber connection — enters subscribe mode, can only sub/unsub */
export const subscriber = new Redis(redisUrl!, redisOptions);

// A subscriber connection can only run pub/sub commands, so presence state
// (hashes) and outbound publishes need their own connection.
export const publisher = new Redis(redisUrl!, redisOptions);

let subReady = false;

subscriber.on("ready", () => {
  if (!subReady) {
    subReady = true;
    console.log("[redis] subscriber connected");
  }
});

subscriber.on("error", (err: Error) => console.error("[redis] subscriber error:", err.message));
publisher.on("error", (err: Error) => console.error("[redis] publisher error:", err.message));

export function subscribeToTopic(topic: string): void {
  subscriber.subscribe(topic).catch((err: Error) => {
    console.error(`[redis] failed to subscribe to ${topic}:`, err.message);
  });
}

export function unsubscribeFromTopic(topic: string): void {
  subscriber.unsubscribe(topic).catch((err: Error) => {
    console.error(`[redis] failed to unsubscribe from ${topic}:`, err.message);
  });
}

export function onRedisMessage(handler: (topic: string, message: string) => void): void {
  subscriber.on("message", handler);
}
