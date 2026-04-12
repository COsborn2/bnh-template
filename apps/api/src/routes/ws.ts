import { Hono } from "hono";
import { publishEvent } from "../lib/redis.js";

const ws = new Hono();

// Validate shared secret on all WS internal routes
ws.use("*", async (c, next) => {
  const secret = c.req.header("X-WS-Secret");
  if (secret !== process.env.WS_API_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

// POST /api/ws/authorize
// Called by the WS server when a client subscribes to a topic.
// Returns 200 to allow, 403 to deny.
ws.post("/authorize", async (c) => {
  const { topic, userId } = await c.req.json<{
    topic: string;
    userId: string;
  }>();

  // ----- EXAMPLE: Chat authorization -----
  // Allows any authenticated user to subscribe to chat:* topics.
  //
  // In production you would:
  //   - Check if the user has access to this specific resource
  //   - Validate the topic format against your domain model
  //   - Check database permissions (e.g., room membership, team access)
  //   - Rate limit subscription attempts
  if (topic.startsWith("chat:")) {
    return c.json({ authorized: true });
  }

  return c.json({ error: "Unknown topic" }, 403);
  // ----- END EXAMPLE -----
});

// POST /api/ws/events
// Called by the WS server when a client sends a message.
// Receives { topic, data, userId, userName, isGuest } and processes the business logic.
ws.post("/events", async (c) => {
  const { topic, data, userId, userName, isGuest } = await c.req.json<{
    topic: string;
    data: unknown;
    userId: string;
    userName: string;
    isGuest: boolean;
  }>();

  // ----- EXAMPLE: Chat message handling -----
  // Echoes the message to all subscribers with sender info.
  //
  // In production you would:
  //   - Validate the message payload (schema, size, content)
  //   - Apply rate limiting per user
  //   - Store the event in the database
  //   - Transform/enrich the data before publishing
  //   - Publish to additional topics if needed (e.g., notifications)
  if (topic.startsWith("chat:")) {
    publishEvent(topic, {
      type: "chat:message",
      userId,
      userName,
      isGuest,
      body: (data as { body?: string })?.body ?? "",
      timestamp: Date.now(),
    });
    return c.json({ ok: true });
  }

  return c.json({ error: "Unhandled topic" }, 400);
  // ----- END EXAMPLE -----
});

export { ws as wsRoutes };
