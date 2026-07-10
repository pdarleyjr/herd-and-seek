import type { MatchMode } from "./types";

// Human-readable room codes like "ABCD-EFGH". Ambiguous characters
// (0/O, 1/I) are excluded to avoid misreads when sharing an invite.
const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomGroup(len: number): string {
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += ROOM_ALPHABET[arr[i] % ROOM_ALPHABET.length];
  return out;
}

export function generateRoomCode(): string {
  return `${randomGroup(4)}-${randomGroup(4)}`;
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export interface SessionRef {
  roomId: string;
  mode: MatchMode;
  hostUserId: string;
  createdAt: number;
}

const SESSION_KEY = "hs_roomSession";

export function saveSession(session: SessionRef): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function loadSession(): SessionRef | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionRef;
    if (parsed && typeof parsed.roomId === "string" && (parsed.mode === "multiplayer" || parsed.mode === "solo")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// Solo sessions must never share a multiplayer room — use a unique, private id.
export function soloRoomId(userId: string): string {
  return `solo:${userId}:${crypto.randomUUID()}`;
}

export function buildSocketUrl(roomId: string, userId: string, username: string): string {
  const base = "wss://herd-and-seek-backend.pdarleyjr.workers.dev";
  const qs = new URLSearchParams({ room: roomId, userId, username });
  return `${base}?${qs.toString()}`;
}
