import type { ServerWebSocket } from "bun";
import { validateSession } from "./auth.js";
import {
  parseClientMessage,
  type WsData,
  type ServerMessage,
} from "./protocol.js";
import {
  initTopics,
  subscribe,
  unsubscribe,
  removeClient,
  getTopicClients,
} from "./topics.js";
import {
  subscribeToTopic,
  unsubscribeFromTopic,
  onRedisMessage,
} from "./redis.js";

const authorizeUrl = process.env.WS_AUTHORIZE_URL;
const eventsUrl = process.env.WS_EVENTS_URL;
const wsApiSecret = process.env.WS_API_SECRET;

if (!authorizeUrl) {
  throw new Error("WS_AUTHORIZE_URL environment variable is required");
}
if (!eventsUrl) {
  throw new Error("WS_EVENTS_URL environment variable is required");
}
if (!wsApiSecret) {
  throw new Error("WS_API_SECRET environment variable is required");
}

// --- Topic manager wired to Redis ---

initTopics({
  onFirstSubscribe: subscribeToTopic,
  onLastUnsubscribe: unsubscribeFromTopic,
});

// --- Redis → local fan-out ---

onRedisMessage((topic, message) => {
  const clients = getTopicClients(topic);
  if (!clients) return;

  let data: unknown;
  try {
    data = JSON.parse(message);
  } catch {
    console.error(`[ws] malformed Redis message on topic ${topic}`);
    return;
  }

  const envelope: ServerMessage = {
    type: "event",
    topic,
    data,
  };
  const payload = JSON.stringify(envelope);

  for (const client of clients) {
    client.send(payload);
  }
});

// --- Helpers ---

function send(ws: ServerWebSocket<WsData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function getGuestIdentity(
  url: URL
): { guestId: string; userId: string; userName: string } | null {
  const guestId = url.searchParams.get("guestId");
  const guestName = url.searchParams.get("guestName")?.trim();

  if (!guestId || !guestName) {
    return null;
  }

  if (!/^[a-zA-Z0-9-]{1,64}$/.test(guestId)) {
    return null;
  }

  if (guestName.length > 40) {
    return null;
  }

  return {
    guestId,
    userId: `guest:${guestId}`,
    userName: guestName,
  };
}

async function authorizeSubscription(
  topic: string,
  userId: string
): Promise<boolean | null> {
  try {
    const res = await fetch(authorizeUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WS-Secret": wsApiSecret!,
      },
      body: JSON.stringify({ topic, userId }),
    });
    if (res.status === 403) return false;
    if (!res.ok) return null;
    return true;
  } catch {
    return null;
  }
}

async function forwardEvent(
  topic: string,
  data: unknown,
  userId: string,
  userName: string,
  isGuest: boolean
): Promise<boolean> {
  try {
    const res = await fetch(eventsUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WS-Secret": wsApiSecret!,
      },
      body: JSON.stringify({ topic, data, userId, userName, isGuest }),
    });
    return res.ok;
  } catch (err) {
    console.error("[ws] failed to forward event:", (err as Error).message);
    return false;
  }
}

// --- Server ---

const port = parseInt(process.env.PORT || "3002");

const server = Bun.serve<WsData>({
  port,
  fetch: async (request, server) => {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only upgrade on /ws or /
    if (url.pathname !== "/ws" && url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    const cookieHeader = request.headers.get("cookie");
    const auth = cookieHeader ? await validateSession(cookieHeader) : null;
    const guest = auth ? null : getGuestIdentity(url);

    if (!auth && !guest) {
      return new Response("Unauthorized", { status: 401 });
    }

    const upgraded = server.upgrade(request, {
      data: {
        userId: auth?.user.id ?? guest!.userId,
        sessionId: auth?.sessionId ?? `guest:${guest!.guestId}`,
        userName: auth?.user.name ?? guest!.userName,
        isGuest: !auth,
        messageTimestamps: [],
      },
    });

    if (!upgraded) {
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return undefined;
  },

  websocket: {
    open(ws) {
      console.log(`[ws] connected: ${ws.data.userId}`);
    },

    async message(ws, raw) {
      // Rate limiting: sliding window of 20 messages per second
      const now = Date.now();
      const windowMs = 1_000;
      const maxPerWindow = 20;
      ws.data.messageTimestamps = ws.data.messageTimestamps.filter(
        (t) => now - t < windowMs
      );
      if (ws.data.messageTimestamps.length >= maxPerWindow) {
        send(ws, {
          type: "error",
          code: "rate_limited",
          message: "Too many messages",
        });
        return;
      }
      ws.data.messageTimestamps.push(now);

      const text = typeof raw === "string" ? raw : raw.toString();
      const msg = parseClientMessage(text);

      if (!msg) {
        send(ws, {
          type: "error",
          code: "invalid_message",
          message: "Invalid message format",
        });
        return;
      }

      // Validate topic format: alphanumeric, colons, underscores, hyphens, max 128 chars
      if ("topic" in msg && !/^[a-zA-Z0-9:_-]{1,128}$/.test(msg.topic)) {
        send(ws, {
          type: "error",
          code: "invalid_topic",
          message: "Invalid topic format",
        });
        return;
      }

      switch (msg.type) {
        case "subscribe": {
          const allowed = await authorizeSubscription(
            msg.topic,
            ws.data.userId
          );
          if (allowed === null) {
            send(ws, {
              type: "error",
              code: "service_unavailable",
              message: "Authorization service is unavailable",
            });
            return;
          }
          if (!allowed) {
            send(ws, {
              type: "error",
              code: "unauthorized",
              message: `Not allowed to subscribe to ${msg.topic}`,
            });
            return;
          }
          const subscribed = subscribe(ws, msg.topic);
          if (!subscribed) {
            send(ws, {
              type: "error",
              code: "subscription_limit",
              message: "Too many active subscriptions",
            });
            return;
          }
          send(ws, { type: "subscribed", topic: msg.topic });
          break;
        }

        case "unsubscribe": {
          unsubscribe(ws, msg.topic);
          send(ws, { type: "unsubscribed", topic: msg.topic });
          break;
        }

        case "message": {
          const ok = await forwardEvent(
            msg.topic,
            msg.data,
            ws.data.userId,
            ws.data.userName,
            ws.data.isGuest
          );
          if (!ok) {
            send(ws, {
              type: "error",
              code: "forward_failed",
              message: "Message could not be delivered",
            });
          }
          break;
        }
      }
    },

    close(ws) {
      console.log(`[ws] disconnected: ${ws.data.userId}`);
      removeClient(ws);
    },
  },
});

console.log(`WebSocket server running on http://localhost:${server.port}`);
