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
  type PresenceUser,
  type PresenceMessage,
  type ServerMessage,
  type RealtimeMessage,
  parseClientMessage,
  isRealtimeMessage,
} from "@app/shared";

import { isRealtimeMessage as isValidEnvelope } from "@app/shared";
import type { RealtimeMessage } from "@app/shared";

// --- Backplane payload decoding ---

/**
 * Classify a parsed Redis payload for fan-out. Valid envelopes pass through
 * unchanged. Payloads without a `kind` field predate the envelope format
 * (direct publishes) and are wrapped as raw event data. Kind-bearing payloads
 * that fail validation — unknown future control kinds, or malformed control
 * envelopes — return null and must be dropped: rebroadcasting them would leak
 * the raw envelope (including `_otel`) to every subscribed client while the
 * intended control action silently never runs.
 */
export function decodeRealtimePayload(
  parsed: unknown
): RealtimeMessage | null {
  if (isValidEnvelope(parsed)) return parsed;
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as { kind?: unknown }).kind === "string"
  ) {
    return null;
  }
  return { kind: "event", data: parsed };
}

// --- Connection Data (Bun ServerWebSocket specific) ---

export interface WsData {
  userId: string;
  sessionId: string;
  userName: string;
  isGuest: boolean;
  /** Timestamps of recent messages for rate limiting */
  messageTimestamps: number[];
}
