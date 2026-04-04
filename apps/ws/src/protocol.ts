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

export type ServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | EventMessage
  | ErrorMessage;

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
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

// --- Connection Data ---

export interface WsData {
  userId: string;
  sessionId: string;
  userName: string;
  /** Timestamps of recent messages for rate limiting */
  messageTimestamps: number[];
}
