// --- Client → Server ---

export interface SubscribeMessage {
  type: "subscribe";
  topic: string;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  topic: string;
}

export interface ClientDataMessage {
  type: "message";
  topic: string;
  data: unknown;
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | ClientDataMessage;

// --- Server → Client ---

export interface SubscribedMessage {
  type: "subscribed";
  topic: string;
}

export interface UnsubscribedMessage {
  type: "unsubscribed";
  topic: string;
}

export interface EventMessage {
  type: "event";
  topic: string;
  data: unknown;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

/** A user currently subscribed to a topic, merged across all WS instances. */
export interface PresenceUser {
  id: string;
  name: string;
  isGuest: boolean;
}

/** The merged online-user list for a topic the client is subscribed to. */
export interface PresenceMessage {
  type: "presence";
  topic: string;
  users: PresenceUser[];
}

export type ServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | EventMessage
  | ErrorMessage
  | PresenceMessage;

// --- Backplane envelope (API → Redis → WS instances) ---
//
// Payloads on the Redis backplane are kind-discriminated envelopes rather
// than raw event data, so the API can instruct every WS instance (kick a
// user, force re-authorization) instead of only relaying data. Publishers
// may attach an additive `_otel` trace-context field; consumers switch on
// `kind` and ignore it, so the envelope stays backward-compatible.

/** Fan `data` out to every local subscriber of the topic. */
export interface RealtimeEventMessage {
  kind: "event";
  data: unknown;
}

/** Close every socket belonging to `userId` on all instances (code 4001). */
export interface RealtimeDisconnectUserMessage {
  kind: "disconnect-user";
  userId: string;
}

/** Re-run subscription authorization for every local subscriber of the topic. */
export interface RealtimeRevalidateTopicMessage {
  kind: "revalidate-topic";
}

/** A WS instance's local roster changed; every instance should re-read the
 *  shared presence hash and push the merged user list to its subscribers. */
export interface RealtimePresenceSyncMessage {
  kind: "presence-sync";
}

export type RealtimeMessage =
  | RealtimeEventMessage
  | RealtimeDisconnectUserMessage
  | RealtimeRevalidateTopicMessage
  | RealtimePresenceSyncMessage;

const REALTIME_KINDS = new Set([
  "event",
  "disconnect-user",
  "revalidate-topic",
  "presence-sync",
]);

/** Narrow a decoded Redis payload to a backplane envelope. Payloads published
 *  outside `publishEvent` (no `kind`) fail this check and should be treated
 *  as raw event data. */
export function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  if (typeof msg.kind !== "string" || !REALTIME_KINDS.has(msg.kind)) {
    return false;
  }
  if (msg.kind === "disconnect-user" && typeof msg.userId !== "string") {
    return false;
  }
  return true;
}

// --- Parsing ---

const VALID_CLIENT_TYPES = new Set(["subscribe", "unsubscribe", "message"]);

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (
      typeof msg !== "object" ||
      msg === null ||
      !VALID_CLIENT_TYPES.has(msg.type) ||
      typeof msg.topic !== "string" ||
      msg.topic.length === 0
    ) {
      return null;
    }

    if (msg.type === "message" && !Object.hasOwn(msg, "data")) {
      return null;
    }

    return msg as ClientMessage;
  } catch {
    return null;
  }
}
