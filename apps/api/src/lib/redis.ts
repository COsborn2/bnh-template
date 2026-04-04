import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is required");
    }
    publisher = new Redis(redisUrl);
    publisher.on("error", (err: Error) =>
      console.error("[redis:api]", err.message)
    );
  }
  return publisher;
}

export function publishEvent(topic: string, data: unknown): void {
  getPublisher()
    .publish(topic, JSON.stringify(data))
    .catch((err: Error) =>
      console.error("[redis:api] publish failed:", err.message)
    );
}
