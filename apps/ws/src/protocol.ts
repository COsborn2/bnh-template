// Re-export protocol types from @app/shared
export {
  type SubscribeMessage,
  type UnsubscribeMessage,
  type ClientDataMessage,
  type ClientMessage,
  type SubscribedMessage,
  type UnsubscribedMessage,
  type EventMessage,
  type ErrorMessage,
  type ServerMessage,
  parseClientMessage,
} from "@app/shared";

// --- Connection Data (Bun ServerWebSocket specific) ---

export interface WsData {
  userId: string;
  sessionId: string;
  userName: string;
  isGuest: boolean;
  /** Timestamps of recent messages for rate limiting */
  messageTimestamps: number[];
}
