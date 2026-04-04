"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseWebSocketOptions {
  /** Topics to subscribe to on connect */
  topics: string[];
  /** Called when an event is received from a subscribed topic */
  onEvent?: (topic: string, data: unknown) => void;
  /** Called when an error message is received from the server */
  onError?: (code: string, message: string) => void;
  /** Called when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
}

type ServerMessage =
  | { type: "subscribed"; topic: string }
  | { type: "unsubscribed"; topic: string }
  | { type: "event"; topic: string; data: unknown }
  | { type: "error"; code: string; message: string };

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

export function useWebSocket({
  topics,
  onEvent,
  onError,
  onConnectionChange,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const [connected, setConnected] = useState(false);

  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const topicsRef = useRef(topics);
  const prevTopicsRef = useRef<string[]>([]);
  const connectRef = useRef<() => void>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
    onConnectionChangeRef.current = onConnectionChange;
    topicsRef.current = topics;
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      setConnected(true);
      onConnectionChangeRef.current?.(true);

      // Subscribe to all topics and track them for diffing
      for (const topic of topicsRef.current) {
        ws.send(JSON.stringify({ type: "subscribe", topic }));
      }
      prevTopicsRef.current = [...topicsRef.current];
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case "event":
            onEventRef.current?.(msg.topic, msg.data);
            break;
          case "error":
            onErrorRef.current?.(msg.code, msg.message);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnected(false);
      onConnectionChangeRef.current?.(false);

      // Exponential backoff reconnect
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** reconnectAttempt.current,
        MAX_RECONNECT_DELAY
      );
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
    };

    ws.onerror = () => {
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
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected, sendMessage };
}
