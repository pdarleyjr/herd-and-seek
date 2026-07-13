import { isValidLevelId, type PlayerState, type SerializedState, type ServerMessage } from "../../types";

const MAX_FRAME_BYTES = 1_000_000;
const SERVER_TYPES = new Set(["SYNC_STATE", "MATCH_START", "HIT", "GAME_OVER", "DECOY_SPAWN", "ADMIN_OK", "ADMIN_DENIED", "ADMIN_LOG"]);

export type FrameParseResult =
  | { ok: true; message: ServerMessage }
  | { ok: false; code: "frame_too_large" | "malformed_frame" | "unknown_message" | "invalid_payload" };

export function parseServerFrame(frame: unknown): FrameParseResult {
  if (typeof frame !== "string") return { ok: false, code: "malformed_frame" };
  if (frame.length > MAX_FRAME_BYTES) return { ok: false, code: "frame_too_large" };
  let value: unknown;
  try { value = JSON.parse(frame); } catch { return { ok: false, code: "malformed_frame" }; }
  if (!isRecord(value) || typeof value.type !== "string") return { ok: false, code: "malformed_frame" };
  if (!SERVER_TYPES.has(value.type)) return { ok: false, code: "unknown_message" };
  if (!isPayloadValid(value.type, value.payload)) return { ok: false, code: "invalid_payload" };
  return { ok: true, message: value as unknown as ServerMessage };
}

function isPayloadValid(type: string, payload: unknown): boolean {
  if (type === "SYNC_STATE" || type === "MATCH_START") return isSerializedState(payload);
  if (type === "HIT") return isRecord(payload) && typeof payload.hit === "boolean" && finite(payload.targetX) && finite(payload.targetY) && (payload.targetId === null || typeof payload.targetId === "string");
  if (type === "GAME_OVER") return isRecord(payload) && (payload.winner === "hunter" || payload.winner === "animals") && typeof payload.reason === "string" && isSerializedState(payload.state);
  if (type === "DECOY_SPAWN") return isRecord(payload) && finite(payload.x) && finite(payload.y) && typeof payload.animalType === "string" && typeof payload.ownerId === "string" && (payload.expiresAt === undefined || finite(payload.expiresAt));
  if (type === "ADMIN_DENIED") return isRecord(payload);
  if (type === "ADMIN_LOG") return isRecord(payload) && Array.isArray(payload.auditLog);
  if (type === "ADMIN_OK") return isRecord(payload) && Array.isArray(payload.auditLog) && isSerializedState(payload.state);
  return false;
}

function isSerializedState(value: unknown): value is SerializedState {
  if (!isRecord(value)) return false;
  if (value.phase !== "LOBBY" && value.phase !== "COUNTDOWN" && value.phase !== "PLAYING" && value.phase !== "ENDED") return false;
  if (!Array.isArray(value.players) || value.players.length > 128 || !value.players.every(isPlayer)) return false;
  if (!Array.isArray(value.npcSeeds) || value.npcSeeds.length > 500 || !value.npcSeeds.every((npc) => isRecord(npc) && finite(npc.x) && finite(npc.y) && typeof npc.id === "number" && typeof npc.animalType === "string")) return false;
  return finite(value.ammo) && finite(value.maxAmmo) && finite(value.timeRemaining) && finite(value.matchDuration)
    && Array.isArray(value.eventLog) && value.eventLog.length <= 100 && value.eventLog.every((entry) => typeof entry === "string")
    && isValidLevelId(value.levelId);
}

function isPlayer(value: unknown): value is PlayerState {
  return isRecord(value) && typeof value.id === "string" && value.id.length <= 200 && typeof value.username === "string" && value.username.length <= 64
    && finite(value.x) && finite(value.y) && typeof value.animalType === "string" && typeof value.isHunter === "boolean"
    && typeof value.isReady === "boolean" && typeof value.isAlive === "boolean" && typeof value.perk === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
