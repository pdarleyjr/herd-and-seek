import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OpenWorldClientMessage,
  OpenWorldServerMessage,
  OpenWorldZoneState,
  OpenWorldProfile,
  QuestProgress,
  QuestId,
  DistrictId,
  ZoneId,
} from "./openWorldTypes";
import { BACKEND_WS_ORIGIN } from "../backend";

const WS_BASE = `${BACKEND_WS_ORIGIN}/open-world`;
const STALE_SOCKET_MS = 12_000;
const WATCHDOG_INTERVAL_MS = 4_000;

export interface RewardEvent {
  coins: number;
  xp: number;
  badges: number;
  reason: string;
  ts: number;
}

export interface UseOpenWorldSocketOptions {
  zoneId?: ZoneId;
  userId: string;
  username: string;
  animalType?: string;
}

export interface UseOpenWorldSocket {
  connected: boolean;
  zoneState: OpenWorldZoneState | null;
  profile: OpenWorldProfile | null;
  questProgress: Record<string, QuestProgress>;
  rewards: RewardEvent[];
  error: { code: string; message: string } | null;
  send: (msg: OpenWorldClientMessage) => void;
  join: (opts: { zoneId: ZoneId; userId: string; username: string; x?: number; y?: number; animalType?: string }) => void;
  sync: (x: number, y: number, animalType?: string) => void;
  collectNode: (nodeId: string) => void;
  acceptQuest: (questId: QuestId) => void;
  claimQuest: (questId: QuestId) => void;
  fastTravel: (districtId: DistrictId) => void;
  leave: () => void;
}

export function useOpenWorldSocket(opts: UseOpenWorldSocketOptions): UseOpenWorldSocket {
  const { zoneId = "savannahReserve", userId, username, animalType } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [zoneState, setZoneState] = useState<OpenWorldZoneState | null>(null);
  const [profile, setProfile] = useState<OpenWorldProfile | null>(null);
  const [questProgress, setQuestProgress] = useState<Record<string, QuestProgress>>({});
  const [rewards, setRewards] = useState<RewardEvent[]>([]);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const closedByUs = useRef(false);
  const joinInfo = useRef<{ userId: string; username: string; zoneId: ZoneId; x?: number; y?: number; animalType?: string } | null>(null);

  // Keep the latest animal type in a ref so the connect effect does not need to
  // depend on it (changing animal type mid-session shouldn't reopen the socket).
  const animalRef = useRef(animalType);
  useEffect(() => {
    animalRef.current = animalType;
  }, [animalType]);

  const send = useCallback((msg: OpenWorldClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!userId || !username) return;
    closedByUs.current = false;
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    let lastFrameAt = Date.now();

    const clearReconnectTimer = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };
    const scheduleReconnect = (delay: number) => {
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => connect(), delay);
    };
    const abandonSocket = (socket: WebSocket | null) => {
      if (!socket) return;
      if (wsRef.current === socket) wsRef.current = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try { socket.close(); } catch { /* already unavailable */ }
      setConnected(false);
    };

    function connect() {
      if (!active || closedByUs.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const current = wsRef.current;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
      const url = `${WS_BASE}?zoneId=${encodeURIComponent(zoneId)}&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        attempts = 0;
        lastFrameAt = Date.now();
        setConnected(true);
        const last = joinInfo.current;
        ws.send(JSON.stringify({
          type: "OPEN_WORLD_JOIN",
          payload: { zoneId, userId, username, x: last?.x, y: last?.y, animalType: last?.animalType ?? animalRef.current },
        } satisfies OpenWorldClientMessage));
      };
      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return;
        lastFrameAt = Date.now();
        try {
          const msg = JSON.parse(event.data as string) as OpenWorldServerMessage;
          switch (msg.type) {
            case "OPEN_WORLD_STATE":
              setZoneState(msg.payload);
              break;
            case "PROFILE_SYNC":
              setProfile(msg.payload);
              setQuestProgress(msg.payload.questProgress ?? {});
              break;
            case "QUEST_UPDATED":
              setQuestProgress((prev) => ({ ...prev, [msg.payload.questId]: msg.payload }));
              break;
            case "REWARD_GRANTED":
              setRewards((prev) => [{ ...msg.payload, ts: Date.now() }, ...prev].slice(0, 8));
              break;
            case "OPEN_WORLD_ERROR":
              setError(msg.payload);
              break;
            default:
              break;
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setConnected(false);
        if (!active || closedByUs.current) return;
        const delay = Math.min(8_000, 500 * 2 ** Math.min(attempts++, 4));
        scheduleReconnect(delay);
      };
      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        abandonSocket(ws);
        if (!active || closedByUs.current) return;
        const delay = Math.min(8_000, 500 * 2 ** Math.min(attempts++, 4));
        scheduleReconnect(delay);
      };
    }
    const reconnectNow = () => {
      if (!active || closedByUs.current || document.hidden) return;
      const current = wsRef.current;
      const stale = current?.readyState === WebSocket.OPEN && Date.now() - lastFrameAt > STALE_SOCKET_MS;
      if (stale || current?.readyState === WebSocket.CLOSING || current?.readyState === WebSocket.CLOSED) abandonSocket(current);
      scheduleReconnect(0);
    };
    const handleOffline = () => {
      clearReconnectTimer();
      abandonSocket(wsRef.current);
    };
    connect();
    window.addEventListener("online", reconnectNow);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", reconnectNow);
    watchdogTimer = setInterval(() => {
      if (!active || closedByUs.current || document.hidden || navigator.onLine === false) return;
      const current = wsRef.current;
      if (current?.readyState === WebSocket.OPEN && Date.now() - lastFrameAt <= STALE_SOCKET_MS) return;
      abandonSocket(current);
      scheduleReconnect(0);
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      active = false;
      closedByUs.current = true;
      clearReconnectTimer();
      if (watchdogTimer) clearInterval(watchdogTimer);
      window.removeEventListener("online", reconnectNow);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", reconnectNow);
      const ws = wsRef.current;
      abandonSocket(ws);
    };
  }, [userId, username, zoneId, send]);

  const join = useCallback(
    (opts: { zoneId: ZoneId; userId: string; username: string; x?: number; y?: number; animalType?: string }) => {
      joinInfo.current = opts;
      send({ type: "OPEN_WORLD_JOIN", payload: opts });
    },
    [send],
  );

  const sync = useCallback((x: number, y: number, animalType?: string) => {
    joinInfo.current = { zoneId, userId, username, x, y, animalType: animalType ?? animalRef.current };
    send({ type: "OPEN_WORLD_SYNC", payload: { x, y, animalType } });
  }, [send, userId, username, zoneId]);

  const collectNode = useCallback((nodeId: string) => {
    send({ type: "COLLECT_NODE", payload: { nodeId } });
  }, [send]);

  const acceptQuest = useCallback((questId: QuestId) => {
    send({ type: "QUEST_ACCEPT", payload: { questId } });
  }, [send]);

  const claimQuest = useCallback((questId: QuestId) => {
    send({ type: "QUEST_CLAIM", payload: { questId } });
  }, [send]);

  const fastTravel = useCallback((districtId: DistrictId) => {
    send({ type: "FAST_TRAVEL", payload: { districtId } });
  }, [send]);

  const leave = useCallback(() => {
    send({ type: "OPEN_WORLD_LEAVE" });
  }, [send]);

  return {
    connected,
    zoneState,
    profile,
    questProgress,
    rewards,
    error,
    send,
    join,
    sync,
    collectNode,
    acceptQuest,
    claimQuest,
    fastTravel,
    leave,
  };
}
