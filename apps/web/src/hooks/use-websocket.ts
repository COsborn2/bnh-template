"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PresenceUser, ServerMessage } from "@app/shared";

export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

interface UseWebSocketOptions {
  /** Topics to subscribe to on connect */
  topics: string[];
  /** Override the websocket URL when query params or a different host are needed */
  url?: string | null;
  /** Skip connecting until required client state is ready */
  enabled?: boolean;
  /** Called when an event is received from a subscribed topic */
  onEvent?: (topic: string, data: unknown) => void;
  /** Called with the merged online-user list for a subscribed topic */
  onPresence?: (topic: string, users: PresenceUser[]) => void;
  /** Called when an error message is received from the server */
  onError?: (code: string, message: string) => void;
  /** Called when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /**
   * Called after the socket re-opens following a drop (not on first connect).
   * Subscriptions are re-delivered automatically, but the socket has no
   * replay buffer — refetch your data here to cover anything broadcast while
   * disconnected. If the refetch fails, tell the user (e.g. a toast:
   * "Reconnected, but refreshing failed — reload if it looks stale"); a stale
   * view behind a connected indicator is worse than an honest error.
   */
  onReconnect?: () => void;
  /**
   * Called when the server intentionally closed the socket with an
   * application close code (4000-4999, e.g. 4001 = disconnected by server).
   * The hook does NOT auto-reconnect after these.
   */
  onServerClose?: (code: number, reason: string) => void;
}

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

export function useWebSocket({
  topics,
  url,
  enabled = true,
  onEvent,
  onPresence,
  onError,
  onConnectionChange,
  onReconnect,
  onServerClose,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const shouldReconnectRef = useRef(enabled);
  // Set when the server closes the socket ON PURPOSE (4000–4999). Those closes
  // park the connection for the life of this mount — the fast-reconnect path
  // below must not resurrect them, or a kicked user loops through reconnects
  // on every tab switch. Readable synchronously from event listeners, unlike
  // the render-facing `socketState`.
  const stoppedRef = useRef(false);
  // Socket lifecycle, driven only from socket callbacks; the render-facing
  // `status` is derived from it plus `enabled` ("idle" = a connect attempt is
  // pending or in flight, "stopped" = the server ended the socket on purpose).
  const [socketState, setSocketState] = useState<
    "idle" | "connected" | "reconnecting" | "stopped"
  >("idle");

  const onEventRef = useRef(onEvent);
  const onPresenceRef = useRef(onPresence);
  const onErrorRef = useRef(onError);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onReconnectRef = useRef(onReconnect);
  const onServerCloseRef = useRef(onServerClose);
  const topicsRef = useRef(topics);
  const prevTopicsRef = useRef<string[]>([]);
  const connectRef = useRef<() => void>(null);
  const urlRef = useRef(url);

  useEffect(() => {
    onEventRef.current = onEvent;
    onPresenceRef.current = onPresence;
    onErrorRef.current = onError;
    onConnectionChangeRef.current = onConnectionChange;
    onReconnectRef.current = onReconnect;
    onServerCloseRef.current = onServerClose;
    topicsRef.current = topics;
    urlRef.current = url;
    shouldReconnectRef.current = enabled;
  });

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl =
      urlRef.current ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;

      const wasReconnect = reconnectAttempt.current > 0;
      reconnectAttempt.current = 0;
      setSocketState("connected");
      onConnectionChangeRef.current?.(true);

      // Subscribe to all topics and track them for diffing
      for (const topic of topicsRef.current) {
        ws.send(JSON.stringify({ type: "subscribe", topic }));
      }
      prevTopicsRef.current = [...topicsRef.current];

      // The socket has no replay buffer — anything broadcast while we were
      // disconnected was missed, so let consumers resync their data.
      if (wasReconnect) {
        onReconnectRef.current?.();
      }
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;

      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case "event":
            onEventRef.current?.(msg.topic, msg.data);
            break;
          case "presence":
            onPresenceRef.current?.(msg.topic, msg.users);
            break;
          case "error":
            onErrorRef.current?.(msg.code, msg.message);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return;

      wsRef.current = null;
      onConnectionChangeRef.current?.(false);

      // Application close codes are deliberate server decisions (kicked,
      // access revoked, session ended) — don't fight them by reconnecting.
      if (event.code >= 4000 && event.code <= 4999) {
        reconnectAttempt.current = 0;
        stoppedRef.current = true;
        setSocketState("stopped");
        onServerCloseRef.current?.(event.code, event.reason);
        return;
      }

      if (!shouldReconnectRef.current) {
        reconnectAttempt.current = 0;
        setSocketState("idle");
        return;
      }

      setSocketState("reconnecting");
      // Exponential backoff with jitter (50–100% of the computed delay).
      // Without the jitter, a server redeploy reconnects — and then resyncs —
      // every client in lockstep.
      const base = Math.min(
        BASE_RECONNECT_DELAY * 2 ** reconnectAttempt.current,
        MAX_RECONNECT_DELAY
      );
      const delay = base / 2 + Math.random() * (base / 2);
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      // onclose will fire after this, triggering reconnect
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  });

  // Diff topics and send subscribe/unsubscribe when topics change while connected
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      prevTopicsRef.current = topics;
      return;
    }

    const prev = new Set(prevTopicsRef.current);
    const next = new Set(topics);

    for (const t of topics) {
      if (!prev.has(t)) {
        ws.send(JSON.stringify({ type: "subscribe", topic: t }));
      }
    }
    for (const t of prevTopicsRef.current) {
      if (!next.has(t)) {
        ws.send(JSON.stringify({ type: "unsubscribe", topic: t }));
      }
    }

    prevTopicsRef.current = topics;
  }, [topics]);

  const sendMessage = useCallback((topic: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", topic, data }));
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = enabled;
    // A deliberate re-enable / url change is allowed to dial again even after
    // the server parked the previous socket.
    stoppedRef.current = false;

    if (!enabled) {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    connect();

    // Backoff caps at 30s, which is exactly wrong for the laptop-wake /
    // network-restored case: the user is back NOW. Skip the remaining delay
    // and reconnect immediately when the network returns or the tab becomes
    // visible — but never disturb a socket that is open or already dialing
    // (connect() only guards against OPEN, so the CONNECTING check here is
    // what prevents a double dial).
    const fastReconnect = () => {
      if (!shouldReconnectRef.current || stoppedRef.current) return;
      if (document.visibilityState === "hidden") return;
      const ready = wsRef.current?.readyState;
      if (ready === WebSocket.OPEN || ready === WebSocket.CONNECTING) return;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // Treat the resulting open as a reconnect so onopen takes the resync
      // path — the socket has no replay buffer.
      reconnectAttempt.current = Math.max(reconnectAttempt.current, 1);
      connectRef.current?.();
    };
    window.addEventListener("online", fastReconnect);
    document.addEventListener("visibilitychange", fastReconnect);

    return () => {
      shouldReconnectRef.current = false;
      window.removeEventListener("online", fastReconnect);
      document.removeEventListener("visibilitychange", fastReconnect);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      // The closed socket's onclose is ignored (its ref was just cleared), so
      // reset here — otherwise a deliberate replacement (url change, enabled
      // toggle) keeps reporting the old socket's "connected" while the new
      // one is still CONNECTING, and sends during that window silently drop.
      setSocketState("idle");
    };
  }, [connect, enabled, url]);

  // Derived rather than set from the effect: while disabled the socket is
  // closed without its onclose handler running (the ref was already cleared),
  // so the last callback-driven state can be stale.
  const status: WebSocketStatus = !enabled
    ? "offline"
    : socketState === "connected"
      ? "connected"
      : socketState === "reconnecting"
        ? "reconnecting"
        : socketState === "stopped"
          ? "offline"
          : "connecting";

  return { connected: status === "connected", status, sendMessage };
}
