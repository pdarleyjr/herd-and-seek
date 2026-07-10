import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage, ConnectionStatus } from "./types";
import { buildSocketUrl } from "./room";

export interface ProtocolDiagnostic {
  code: string;
  detail: string;
  timestamp: number;
}

export interface UseGameSocketOptions {
  enabled: boolean;
  roomId: string | null;
  userId: string;
  username: string;
  onMessage: (message: ServerMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onProtocolError?: (error: ProtocolDiagnostic) => void;
}

const MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 500;

function nextBackoff(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  // Jitter ±25% to avoid thundering-herd reconnects.
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.max(BASE_BACKOFF_MS, Math.round(exp + jitter));
}

export function useGameSocket(options: UseGameSocketOptions) {
  const { enabled, roomId, userId, username, onMessage, onStatusChange, onProtocolError } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const onMessageRef = useRef(onMessage);
  const onStatusRef = useRef(onStatusChange);
  const onProtocolErrorRef = useRef(onProtocolError);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });
  useEffect(() => {
    onStatusRef.current = onStatusChange;
  });
  useEffect(() => {
    onProtocolErrorRef.current = onProtocolError;
  });

  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionGenerationRef = useRef(0);
  const attemptRef = useRef(0);

  const setStatusSafe = useCallback((s: ConnectionStatus) => {
    setStatus(s);
    onStatusRef.current?.(s);
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !roomId || !userId || !username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusSafe("idle");
      return;
    }

    const generation = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = generation;
    intentionalCloseRef.current = false;
    attemptRef.current = 0;

    const connect = () => {
      // Bail if a newer connection generation started (room/user changed, unmount).
      if (generation !== connectionGenerationRef.current) return;
      if (!enabled) return;
      setStatusSafe("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(buildSocketUrl(roomId, userId, username));
      } catch {
        setStatusSafe("failed");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (generation !== connectionGenerationRef.current) return;
        attemptRef.current = 0;
        setStatusSafe("connected");
      };

      ws.onmessage = (event) => {
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          onProtocolErrorRef.current?.({ code: "malformed_frame", detail: "Failed to parse server message", timestamp: Date.now() });
          return;
        }
        onMessageRef.current(data);
      };

      ws.onerror = () => {
        if (generation !== connectionGenerationRef.current) return;
        // onclose will handle scheduling reconnect.
        setStatusSafe("disconnected");
      };

      ws.onclose = (event) => {
        if (intentionalCloseRef.current) return;
        if (generation !== connectionGenerationRef.current) return;
        if (event.code === 4001) {
          // room_closed — do not auto-reconnect.
          setStatusSafe("failed");
          return;
        }
        if (event.code === 4002) {
          setStatusSafe("failed");
          return;
        }
        setStatusSafe("reconnecting");
        const delay = nextBackoff(attemptRef.current++);
        clearReconnect();
        reconnectTimerRef.current = setTimeout(() => {
          if (generation === connectionGenerationRef.current && enabled) connect();
        }, delay);
      };
    };

    connect();

    return () => {
      // Intentional teardown: stop reconnects, close the socket, never reconnect.
      intentionalCloseRef.current = true;
      connectionGenerationRef.current += 1;
      clearReconnect();
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "client_leave");
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setStatusSafe("idle");
    };
  }, [enabled, roomId, userId, username, clearReconnect, setStatusSafe]);

  return { send, status };
}
