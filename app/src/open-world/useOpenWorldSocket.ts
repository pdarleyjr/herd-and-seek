import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OpenWorldClientMessage,
  OpenWorldServerMessage,
  OpenWorldZoneState,
  OpenWorldProfile,
  QuestProgress,
  QuestId,
  ZoneId,
} from "./openWorldTypes";
import { BACKEND_WS_ORIGIN } from "../backend";

const WS_BASE = `${BACKEND_WS_ORIGIN}/open-world`;

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

    const url = `${WS_BASE}?zoneId=${encodeURIComponent(zoneId)}&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Auto-join with the last saved position if available (server clamps).
      const last = joinInfo.current;
      send({
        type: "OPEN_WORLD_JOIN",
        payload: {
          zoneId,
          userId,
          username,
          x: last?.x,
          y: last?.y,
          animalType: last?.animalType ?? animalRef.current,
        },
      });
    };

    ws.onmessage = (event) => {
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

    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };

    return () => {
      closedByUs.current = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
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
    send({ type: "OPEN_WORLD_SYNC", payload: { x, y, animalType } });
  }, [send]);

  const collectNode = useCallback((nodeId: string) => {
    send({ type: "COLLECT_NODE", payload: { nodeId } });
  }, [send]);

  const acceptQuest = useCallback((questId: QuestId) => {
    send({ type: "QUEST_ACCEPT", payload: { questId } });
  }, [send]);

  const claimQuest = useCallback((questId: QuestId) => {
    send({ type: "QUEST_CLAIM", payload: { questId } });
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
    leave,
  };
}
