import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage } from "./types";

const WS_URL = "wss://herd-and-seek-backend.pdarleyjr.workers.dev";

export function useGameSocket(
  userId: string,
  username: string,
  onMessage: (data: ServerMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectRef = useRef(false);
  // Keep latest message handler in a ref so the WebSocket connection is not
  // torn down & rebuilt whenever the callback identity changes (e.g. on every
  // game-state update). The connection effect depends only on the stable
  // userId/username, guaranteeing a single persistent socket.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!userId || !username) return;

    const connect = () => {
      const url = `${WS_URL}?userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerMessage;
          onMessageRef.current(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!reconnectRef.current) {
          reconnectRef.current = true;
          setTimeout(() => {
            if (reconnectRef.current) connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      reconnectRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, username]);

  return { send, connected };
}
