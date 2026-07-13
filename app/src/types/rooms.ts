export type RoomVisibility = "public" | "private";
export type RoomActivity = "hunt" | "soccer";
export type RoomPhase = "LOBBY" | "COUNTDOWN" | "PLAYING" | "ENDED";

export interface RoomSummary {
  roomId: string;
  name: string;
  visibility: RoomVisibility;
  activity: RoomActivity;
  playerCount: number;
  maxPlayers: number;
  phase: RoomPhase;
  joinable: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RoomAccess {
  room: RoomSummary;
  /** Opaque, revocable credential. It is never a room password. */
  accessToken?: string;
}

export interface CreateRoomInput {
  name: string;
  visibility: RoomVisibility;
  password?: string;
  maxPlayers: number;
  activity?: RoomActivity;
}

export interface JoinRoomInput {
  roomId?: string;
  roomName?: string;
  password?: string;
  activity?: RoomActivity;
}
