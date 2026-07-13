// Shared frontend types for the Open World (Savannah Reserve) mode.
// These mirror the authoritative shapes defined in worker/src/index.ts. The
// server is the source of truth; the client only renders and sends intents.

export type GameMode = "match" | "openWorld";
export type ZoneId = "savannahReserve";

export type DistrictId =
  | "lodge"
  | "grasslands"
  | "wateringHole"
  | "ridgeTrail"
  | "acaciaGrove"
  | "moonfernForest"
  | "strikerField";

export type QuestId =
  | "daily_scout_tracks"
  | "daily_collect_tokens"
  | "daily_blend_herd"
  | "repeat_gather_food"
  | "repeat_camera_tag"
  | "repeat_water_run";

export type QuestStatus = "available" | "active" | "complete" | "claimed";

export type QuestObjective =
  | "collect"
  | "visit"
  | "camera_tag"
  | "survive_timer"
  | "blend_near_herd";

// The server profile snapshot as received over the open-world socket. Only the
// fields the open-world HUD needs are represented; the server owns the rest.
export interface OpenWorldProfile {
  userId: string;
  username: string;
  xp: number;
  level: number;
  coins: number;
  badges: number;
  ownedCosmetics: string[];
  selectedCosmetic: string | null;
  questProgress: Record<string, QuestProgress>;
  openWorld: {
    lastZoneId: ZoneId | null;
    lastX: number;
    lastY: number;
    discoveredZones: ZoneId[];
    collectedNodeIds: string[];
  };
  stats: Record<string, number>;
  isAdmin: boolean;
}

export interface QuestProgress {
  questId: QuestId;
  status: QuestStatus;
  progress: number;
  targetCount: number;
  completedAt?: number;
  claimedAt?: number;
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  objectiveType: QuestObjective;
  targetCount: number;
  reward: { coins: number; xp: number; badges?: number };
  daily: boolean;
}

export interface OpenWorldPlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  animalType: string;
  selectedCosmetic: string | null;
  level: number;
}

export interface CollectibleNode {
  id: string;
  x: number;
  y: number;
  kind: "coin" | "token" | "supply" | "track";
  value: number;
}

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  endsAt: number;
  rewardMultiplier?: number;
}

export interface OpenWorldZoneState {
  zoneId: ZoneId;
  players: OpenWorldPlayerState[];
  collectibles: CollectibleNode[];
  quests: QuestDefinition[];
  activeWorldEvent: WorldEvent | null;
  serverTime: number;
}

// ── Protocol (client -> server) ──────────────────────────────────────────────
export type OpenWorldClientMessage =
  | { type: "OPEN_WORLD_JOIN"; payload: { zoneId: ZoneId; userId: string; username: string; x?: number; y?: number; animalType?: string } }
  | { type: "OPEN_WORLD_LEAVE" }
  | { type: "OPEN_WORLD_SYNC"; payload: { x: number; y: number; animalType?: string } }
  | { type: "QUEST_ACCEPT"; payload: { questId: QuestId } }
  | { type: "QUEST_PROGRESS"; payload: { questId: QuestId; amount: number; evidence?: unknown } }
  | { type: "QUEST_CLAIM"; payload: { questId: QuestId } }
  | { type: "COLLECT_NODE"; payload: { nodeId: string } };

// ── Protocol (server -> client) ──────────────────────────────────────────────
export type OpenWorldServerMessage =
  | { type: "OPEN_WORLD_STATE"; payload: OpenWorldZoneState }
  | { type: "PROFILE_SYNC"; payload: OpenWorldProfile }
  | { type: "QUEST_UPDATED"; payload: QuestProgress }
  | { type: "REWARD_GRANTED"; payload: { coins: number; xp: number; badges: number; reason: string } }
  | { type: "COLLECTIBLE_COLLECTED"; payload: { nodeId: string; byUserId: string } }
  | { type: "OPEN_WORLD_ERROR"; payload: { code: string; message: string } };

// Four times the playable area of the original reserve while retaining a
// single coordinate space and scene. The server mirrors these bounds.
export const OPEN_WORLD_WORLD_SIZE = 6000;

export const DISTRICTS: { id: DistrictId; name: string; cx: number; cy: number }[] = [
  { id: "lodge", name: "Ranger Outpost", cx: 3000, cy: 3000 },
  { id: "grasslands", name: "Sunstep Grasslands", cx: 1300, cy: 3200 },
  { id: "wateringHole", name: "Tideglass Wetlands", cx: 4750, cy: 4450 },
  { id: "ridgeTrail", name: "Ember Ridge", cx: 3100, cy: 750 },
  { id: "acaciaGrove", name: "Acacia Grove", cx: 4750, cy: 1450 },
  { id: "moonfernForest", name: "Moonfern Forest", cx: 1050, cy: 1050 },
  { id: "strikerField", name: "Striker Field", cx: 4750, cy: 3000 },
];
