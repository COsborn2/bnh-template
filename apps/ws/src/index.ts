import "./instrumentation.js";
import type { ServerWebSocket } from "bun";
import {
  SpanKind,
  withExtractedContext,
  withServerSpan,
  withSpan,
} from "@app/otel";
import {
  validateSession,
  WsAuthContractError,
  WsAuthUnavailableError,
  type AuthResult,
} from "./auth.js";
import {
  parseClientMessage,
  decodeRealtimePayload,
  type WsData,
  type ServerMessage,
  type RealtimeMessage,
  type PresenceUser,
} from "./protocol.js";
import {
  initTopics,
  subscribe,
  unsubscribe,
  removeClient,
  getTopicClients,
  getActiveTopics,
} from "./topics.js";
import {
  subscribeToTopic,
  unsubscribeFromTopic,
  onRedisMessage,
  publisher,
} from "./redis.js";
import {
  mergeRosters,
  serializeRoster,
  ROSTER_HEARTBEAT_MS,
  ROSTER_STALE_MS,
} from "./presence.js";

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
  onLastUnsubscribe: (topic) => {
    lastPresenceJson.delete(topic);
    unsubscribeFromTopic(topic);
  },
});

// --- Presence (multi-instance, Redis-backed) ---

/** Identifies this ws instance's roster field in each topic's presence hash. */
const instanceId = crypto.randomUUID();

function presenceKey(topic: string): string {
  return `presence:${topic}`;
}

function collectLocalUsers(topic: string): PresenceUser[] {
  const clients = getTopicClients(topic);
  const seen = new Set<string>();
  const users: PresenceUser[] = [];
  for (const ws of clients ?? []) {
    if (seen.has(ws.data.userId)) continue;
    seen.add(ws.data.userId);
    users.push({
      id: ws.data.userId,
      name: ws.data.userName,
      isGuest: ws.data.isGuest,
    });
  }
  return users;
}

/** Last merged list sent per topic, to keep the heartbeat and peer syncs
 *  quiet when nothing changed. Local changes broadcast ungated (via
 *  broadcastPresence) so a client that just subscribed gets its initial list. */
const lastPresenceJson = new Map<string, string>();

/** Merge all instances' rosters and push the result to local subscribers. */
async function broadcastMergedPresence(
  topic: string,
  options?: { onlyIfChanged?: boolean }
): Promise<void> {
  const clients = getTopicClients(topic);
  if (!clients || clients.size === 0) return;

  const rosters = await publisher.hgetall(presenceKey(topic));
  const users = mergeRosters(rosters, Date.now());

  // Re-check after the await — the last subscriber may have left meanwhile.
  const current = getTopicClients(topic);
  if (!current || current.size === 0) return;

  const usersJson = JSON.stringify(users);
  if (options?.onlyIfChanged && lastPresenceJson.get(topic) === usersJson) {
    return;
  }
  lastPresenceJson.set(topic, usersJson);

  const payload = JSON.stringify({
    type: "presence",
    topic,
    users,
  } satisfies ServerMessage);
  for (const ws of current) {
    ws.send(payload);
  }
}

/**
 * Publish this instance's roster for a topic, nudge the other instances to
 * re-broadcast the merged user list, and push it to local subscribers
 * directly. Called on every local presence change.
 */
function broadcastPresence(topic: string): void {
  void (async () => {
    const key = presenceKey(topic);
    const clients = getTopicClients(topic);
    if (!clients || clients.size === 0) {
      await publisher.hdel(key, instanceId);
    } else {
      await publisher.hset(
        key,
        instanceId,
        serializeRoster(collectLocalUsers(topic), Date.now())
      );
      // Safety net so an abandoned topic's hash doesn't linger forever; the
      // heartbeat keeps it alive while any instance still has subscribers.
      await publisher.pexpire(key, ROSTER_STALE_MS * 4);
    }
    await publisher.publish(
      topic,
      JSON.stringify({ kind: "presence-sync" } satisfies RealtimeMessage)
    );
    // Push to local subscribers directly instead of relying on receiving our
    // own publish — the topic subscription may still be settling right after
    // the first subscriber joins. Ungated so a client that just subscribed
    // always gets its initial list, even when the merged roster is unchanged
    // (second tab of an already-online user).
    await broadcastMergedPresence(topic);
  })().catch((err: Error) =>
    console.error(`[ws] presence sync failed for topic ${topic}:`, err.message)
  );
}

// Re-stamp this instance's rosters so peers don't consider them stale, and
// re-merge so users from a crashed instance drop off once its roster ages
// out (crashes never send the hdel + presence-sync that a clean close does).
setInterval(() => {
  for (const topic of getActiveTopics()) {
    void (async () => {
      await publisher.hset(
        presenceKey(topic),
        instanceId,
        serializeRoster(collectLocalUsers(topic), Date.now())
      );
      await publisher.pexpire(presenceKey(topic), ROSTER_STALE_MS * 4);
      await broadcastMergedPresence(topic, { onlyIfChanged: true });
    })().catch((err: Error) =>
      console.error(
        `[ws] presence heartbeat failed for topic ${topic}:`,
        err.message
      )
    );
  }
}, ROSTER_HEARTBEAT_MS);

// --- Backplane control messages ---

/** Close every local socket belonging to `userId` that is subscribed to the
 *  topic the control message arrived on. Runs on every instance, so the user
 *  is disconnected across all replicas. */
function disconnectUser(topic: string, userId: string): void {
  const clients = getTopicClients(topic);
  if (!clients) return;

  const matches = [...clients].filter((ws) => ws.data.userId === userId);
  if (matches.length === 0) return;

  const affectedTopics = new Set<string>([topic]);
  for (const ws of matches) {
    for (const t of removeClient(ws)) {
      affectedTopics.add(t);
    }
  }
  for (const ws of matches) {
    // Application close code — the client hook must not auto-reconnect.
    ws.close(4001, "Disconnected by server");
  }

  // Even with no local sockets left, the shared roster and the other
  // instances still need to hear about the departure.
  for (const t of affectedTopics) {
    broadcastPresence(t);
  }
}

/** Re-run subscription authorization for every local subscriber of a topic
 *  and drop the ones whose access was revoked. */
async function revalidateTopic(topic: string): Promise<void> {
  const clients = getTopicClients(topic);
  if (!clients || clients.size === 0) return;

  // One authorization check per user, not per socket.
  const sockets = [...clients];
  const verdicts = new Map<string, boolean | null>();
  for (const ws of sockets) {
    if (!verdicts.has(ws.data.userId)) {
      verdicts.set(
        ws.data.userId,
        await authorizeSubscription(topic, ws.data.userId)
      );
    }
  }

  let changed = false;
  for (const ws of sockets) {
    const allowed = verdicts.get(ws.data.userId);
    if (allowed === null) {
      // Auth service unavailable — keep the subscription rather than kicking
      // users over a transient outage.
      console.error(
        `[ws] skipped access revalidation for ${ws.data.userId} on ${topic}: authorization service unavailable`
      );
      continue;
    }
    if (allowed === false) {
      unsubscribe(ws, topic);
      send(ws, {
        type: "error",
        code: "access_revoked",
        message: `Access to ${topic} was revoked`,
      });
      changed = true;
    }
  }

  if (changed) {
    broadcastPresence(topic);
  }
}

// --- Redis → local fan-out ---

function handleRealtimeMessage(topic: string, message: RealtimeMessage): void {
  switch (message.kind) {
    case "event": {
      const clients = getTopicClients(topic);
      if (!clients || clients.size === 0) return;

      const payload = JSON.stringify({
        type: "event",
        topic,
        data: message.data,
      } satisfies ServerMessage);
      for (const ws of clients) {
        ws.send(payload);
      }
      return;
    }

    case "disconnect-user":
      disconnectUser(topic, message.userId);
      return;

    case "revalidate-topic":
      void revalidateTopic(topic);
      return;

    case "presence-sync":
      // Gated: local newcomers get their initial list from their own
      // instance's direct broadcast, so an unchanged merged list means
      // there's nothing new to tell local subscribers.
      void broadcastMergedPresence(topic, { onlyIfChanged: true }).catch(
        (err: Error) =>
          console.error(
            `[ws] presence merge failed for topic ${topic}:`,
            err.message
          )
      );
      return;
  }
}

onRedisMessage((topic, rawMessage) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    console.error(`[ws] malformed Redis message on topic ${topic}`);
    return;
  }

  // Payloads published outside publishEvent carry no envelope — treat the
  // whole payload as event data so direct publishes keep working. Envelopes
  // whose `kind` is unrecognized or malformed are dropped, never rebroadcast
  // to clients: deploy new control kinds to ws before the api publishes them.
  const message = decodeRealtimePayload(parsed);
  if (!message) {
    console.error(
      `[ws] dropped unrecognized backplane envelope kind "${(parsed as { kind: string }).kind}" on topic ${topic}`
    );
    return;
  }

  // Continue the API's trace across the pub/sub boundary (see the api-side
  // publish helpers, which inject `_otel` into the envelope).
  const otel =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { _otel?: Record<string, string> })._otel
      : undefined;

  withExtractedContext(otel, () => {
    void withSpan(
      "ws.broadcast",
      async () => handleRealtimeMessage(topic, message),
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          "messaging.system": "redis",
          "messaging.source.name": topic,
          "messaging.operation": "receive",
          "ws.message.kind": message.kind,
        },
      }
    );
  });
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

    return withServerSpan(
      `ws ${request.method} ${url.pathname}`,
      request.headers,
      async () => {
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
        let auth: AuthResult | null = null;
        if (cookieHeader) {
          try {
            auth = await validateSession(cookieHeader);
          } catch (error) {
            // Don't collapse infrastructure failures into 401 — clients (and
            // the reconnect loop) must be able to tell "my session is
            // invalid, stop" from "the API is restarting, retry".
            if (error instanceof WsAuthContractError) {
              console.error(`[ws] ${error.message}`);
              return new Response("WS auth contract violation", {
                status: 502,
              });
            }
            if (error instanceof WsAuthUnavailableError) {
              console.error(`[ws] ${error.message}`);
              return new Response("WS auth unavailable", { status: 503 });
            }
            throw error;
          }
        }
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
      {
        "messaging.system": "websocket",
        "http.request.method": request.method,
        "url.path": url.pathname,
      }
    );
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
          // The socket may have closed during the authorize round trip — its
          // close handler already ran, so subscribing it now would leak a
          // ghost client into the topic maps (and keep its user in presence
          // forever). readyState 1 = OPEN.
          if (ws.readyState !== 1) return;
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
          broadcastPresence(msg.topic);
          break;
        }

        case "unsubscribe": {
          unsubscribe(ws, msg.topic);
          send(ws, { type: "unsubscribed", topic: msg.topic });
          broadcastPresence(msg.topic);
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
      const topics = removeClient(ws);
      for (const topic of topics) {
        broadcastPresence(topic);
      }
    },
  },
});

console.log(`WebSocket server running on http://localhost:${server.port}`);
