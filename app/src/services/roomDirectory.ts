import { BACKEND_ORIGIN } from "../backend";
import type { CreateRoomInput, JoinRoomInput, RoomAccess, RoomActivity, RoomPhase, RoomSummary, RoomVisibility } from "../types/rooms";

interface ApiErrorPayload {
  error?: unknown;
  detail?: unknown;
}

export class RoomDirectoryError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    status: number,
    message: string,
  ) {
    super(message);
    this.name = "RoomDirectoryError";
    this.code = code;
    this.status = status;
  }
}

function isVisibility(value: unknown): value is RoomVisibility {
  return value === "public" || value === "private";
}

function isPhase(value: unknown): value is RoomPhase {
  return value === "LOBBY" || value === "COUNTDOWN" || value === "PLAYING" || value === "ENDED";
}

function parseRoom(value: unknown): RoomSummary {
  if (!value || typeof value !== "object") throw new RoomDirectoryError("invalid_response", 502, "Room service returned an invalid response.");
  const room = value as Partial<RoomSummary>;
  if (
    typeof room.roomId !== "string" || typeof room.name !== "string" || !isVisibility(room.visibility)
    || typeof room.playerCount !== "number" || typeof room.maxPlayers !== "number" || !isPhase(room.phase)
    || typeof room.joinable !== "boolean" || typeof room.createdAt !== "number" || typeof room.updatedAt !== "number"
  ) {
    throw new RoomDirectoryError("invalid_response", 502, "Room service returned an invalid response.");
  }
  return { ...room, activity: room.activity === "soccer" ? "soccer" : "hunt" } as RoomSummary;
}

async function apiRequest(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_ORIGIN}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new RoomDirectoryError("network_error", 0, "Could not reach the room service. Try again.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new RoomDirectoryError("invalid_response", response.status, "Room service returned an invalid response.");
  }
  if (!response.ok) {
    const error = payload as ApiErrorPayload;
    throw new RoomDirectoryError(
      typeof error.error === "string" ? error.error : "request_failed",
      response.status,
      typeof error.detail === "string" ? error.detail : "The room request could not be completed.",
    );
  }
  return payload;
}

export async function listPublicRooms(signal?: AbortSignal, activity: RoomActivity = "hunt"): Promise<RoomSummary[]> {
  const payload = await apiRequest(`/api/rooms?activity=${encodeURIComponent(activity)}`, { method: "GET", signal }) as { rooms?: unknown };
  if (!Array.isArray(payload.rooms)) throw new RoomDirectoryError("invalid_response", 502, "Room service returned an invalid response.");
  return payload.rooms.map(parseRoom).filter((room) => room.visibility === "public" && room.joinable && room.activity === activity);
}

function parseAccess(payload: unknown): RoomAccess {
  if (!payload || typeof payload !== "object") throw new RoomDirectoryError("invalid_response", 502, "Room service returned an invalid response.");
  const result = payload as { room?: unknown; accessToken?: unknown };
  if (result.accessToken !== undefined && typeof result.accessToken !== "string") {
    throw new RoomDirectoryError("invalid_response", 502, "Room service returned an invalid response.");
  }
  return { room: parseRoom(result.room), ...(result.accessToken ? { accessToken: result.accessToken } : {}) };
}

export async function createRoom(input: CreateRoomInput): Promise<RoomAccess> {
  return parseAccess(await apiRequest("/api/rooms", { method: "POST", body: JSON.stringify(input) }));
}

export async function joinRoom(input: JoinRoomInput): Promise<RoomAccess> {
  return parseAccess(await apiRequest("/api/rooms/join", { method: "POST", body: JSON.stringify(input) }));
}

export function roomDirectoryErrorMessage(error: unknown): string {
  return error instanceof RoomDirectoryError ? error.message : "Something went wrong. Try again.";
}
