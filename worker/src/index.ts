// ─────────────────────────────────────────────────────────────────────────────

export { SoccerRoomDurableObject } from "./soccerRoom";
// Herd & Seek — backend Worker
//
// Modes:
//   • "match"     — realtime hide & seek (GameRoomDurableObject)
//   • "openWorld" — Savannah Reserve roam/quest mode (OpenWorldZoneDurableObject)
//
// Security model (see deployment rules):
//   • Public clients may GET their own profile, PURCHASE owned-item-gated cosmetics,
//     and SELECT owned cosmetics. They may NOT grant currency/xp/badges.
//   • reward / admin-grant / ow_sync are server-only and require an internal
//     secret (INTERNAL_REWARD_SECRET) or the admin key (ADMIN_KEY), both set via
//     `wrangler secret put` — never committed.
//   • Every balance mutation writes an immutable ledger entry.
// ─────────────────────────────────────────────────────────────────────────────

export type AnimalType =
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake"
  | "fish" | "turtle" | "crab" | "octopus"
  | "jellyfish" | "shark" | "seahorse" | "stingray"
  | "zebra" | "gazelle" | "wildebeest" | "warthog"
  | "ostrich" | "meerkat" | "hyena" | "secretarybird";
export type PerkType = "sprint" | "camouflage" | "extraLife" | "decoy" | "speedBoost" | "none";
export type GamePhase = "LOBBY" | "COUNTDOWN" | "PLAYING" | "ENDED";

export function resolveReadyState(current: boolean, requested: boolean | undefined, phase: GamePhase): boolean {
  if (phase === "LOBBY") return requested ?? !current;
  // READY is idempotent during the countdown. Only an explicit stand-down can
  // cancel it; delayed or duplicated ready frames must not toggle the room.
  if (phase === "COUNTDOWN") return requested === false ? false : current;
  return current;
}
export type SoloDifficulty = "easy" | "normal" | "hard";

// Matches may never use the legacy global default room. Clients must always
// connect with an explicit room id (multiplayer code, or a solo room id).
const COUNTDOWN_MS = 3000;
const MAX_PLAYERS_DEFAULT = 8;

// ── Level system (mirrors app/src/types.ts — keep both in sync) ─────────────
export type LevelId = "forest" | "deepDark" | "savannah";

const FOREST_ANIMALS: AnimalType[] = [
  "rabbit", "bear", "owl", "snake",
  "frog", "duck", "dog", "panda",
];

const OCEAN_ANIMALS: AnimalType[] = [
  "fish", "turtle", "crab", "octopus",
  "jellyfish", "shark", "seahorse", "stingray",
];

const SAVANNAH_ANIMALS: AnimalType[] = [
  "zebra", "gazelle", "wildebeest", "warthog",
  "ostrich", "meerkat", "hyena", "secretarybird",
];

const LEVEL_ANIMALS: Record<LevelId, AnimalType[]> = {
  forest: FOREST_ANIMALS,
  deepDark: OCEAN_ANIMALS,
  savannah: SAVANNAH_ANIMALS,
};

export function isValidLevelId(id: unknown): id is LevelId {
  return id === "forest" || id === "deepDark" || id === "savannah";
}
export function animalsForLevel(levelId: LevelId): AnimalType[] {
  return LEVEL_ANIMALS[levelId];
}
export function isAnimalAllowed(animal: AnimalType, levelId: LevelId): boolean {
  return LEVEL_ANIMALS[levelId].includes(animal);
}
export function defaultAnimalForLevel(levelId: LevelId): AnimalType {
  return LEVEL_ANIMALS[levelId][0];
}

// ── Match-mode shared types ──────────────────────────────────────────────────
export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  animalType: AnimalType;
  isHunter: boolean;
  isReady: boolean;
  isAlive: boolean;
  perk: PerkType;
  extraLifeUsed: boolean;
  connId?: string;
  isBot?: boolean;
  botVx?: number;
  botVy?: number;
  botLastDecision?: number;
  botLastShot?: number;
  botPatrolling?: boolean;
  botPatrolX?: number;
  botPatrolY?: number;
  botLastUpdate?: number;
  perkActiveUntil?: number;
  perkCooldownUntil?: number;
  perkConsumed?: boolean;
  lastMoveAt?: number;
  lastMoveSequence?: number;
  lastShotAt?: number;
}

const PERK_TIMING = {
  sprint: { duration: 1_500, cooldown: 8_000 },
  camouflage: { duration: 3_000, cooldown: 10_000 },
  decoy: { duration: 8_000, cooldown: 12_000 },
} as const;

type ActivatablePerk = keyof typeof PERK_TIMING;

export function activatePerk(
  player: Pick<PlayerState, "perk" | "perkActiveUntil" | "perkCooldownUntil" | "perkConsumed" | "lastMoveAt">,
  now: number,
): { ok: true; effect: ActivatablePerk } | { ok: false; reason: "cooldown" | "passive" | "automatic" | "none" | "consumed" | "moving" } {
  if (player.perk === "speedBoost") return { ok: false, reason: "passive" };
  if (player.perk === "extraLife") return { ok: false, reason: "automatic" };
  if (player.perk === "none") return { ok: false, reason: "none" };
  if (player.perkConsumed) return { ok: false, reason: "consumed" };
  if ((player.perkCooldownUntil ?? 0) > now) return { ok: false, reason: "cooldown" };
  if (player.perk === "camouflage" && player.lastMoveAt && now - player.lastMoveAt < 180) return { ok: false, reason: "moving" };
  const perk = player.perk as ActivatablePerk;
  const timing = PERK_TIMING[perk];
  player.perkActiveUntil = now + timing.duration;
  player.perkCooldownUntil = now + timing.cooldown;
  return { ok: true, effect: perk };
}

export function allowedMovementDistance(
  player: Pick<PlayerState, "isHunter" | "perk" | "perkActiveUntil">,
  now: number,
  elapsedMs: number,
): number {
  let unitsPerSecond = (player.isHunter ? 3.7 : 3.2) * 72;
  if (!player.isHunter && player.perk === "speedBoost") unitsPerSecond *= 1.3;
  if (!player.isHunter && player.perk === "sprint" && (player.perkActiveUntil ?? 0) > now) unitsPerSecond *= 1.5;
  return unitsPerSecond * (Math.max(0, Math.min(250, elapsedMs)) / 1_000);
}

export function safeMatchSpawn(index: number): { x: number; y: number } {
  const slot = Math.max(0, Math.floor(index)) % 16;
  if (slot === 0) return { x: 1_400, y: 1_400 };
  const ring = slot <= 8 ? 520 : 820;
  const count = slot <= 8 ? 8 : 7;
  const position = slot <= 8 ? slot - 1 : slot - 9;
  const angle = position / count * Math.PI * 2 - Math.PI / 2;
  return { x: Math.round(1_400 + Math.cos(angle) * ring), y: Math.round(1_400 + Math.sin(angle) * ring) };
}

export interface DifficultyTuning {
  movement: number;
  animalDecisionMs: number;
  animalDecisionJitterMs: number;
  patrolChance: number;
  patrolSpeed: number;
  chaseSpeed: number;
  shootRange: number;
  shotCooldownMs: number;
  shotSpread: number;
  humanHunterAmmo: number;
  aiHunterAmmo: number;
  rewardMultiplier: number;
}

export const DIFFICULTY_TUNING: Record<SoloDifficulty, DifficultyTuning> = {
  easy: { movement: 0.72, animalDecisionMs: 1_550, animalDecisionJitterMs: 2_100, patrolChance: 0.72, patrolSpeed: 135, chaseSpeed: 175, shootRange: 215, shotCooldownMs: 5_200, shotSpread: 310, humanHunterAmmo: 14, aiHunterAmmo: 6, rewardMultiplier: 0.65 },
  normal: { movement: 1, animalDecisionMs: 900, animalDecisionJitterMs: 1_450, patrolChance: 0.5, patrolSpeed: 185, chaseSpeed: 245, shootRange: 265, shotCooldownMs: 3_000, shotSpread: 155, humanHunterAmmo: 9, aiHunterAmmo: 9, rewardMultiplier: 1 },
  hard: { movement: 1.38, animalDecisionMs: 380, animalDecisionJitterMs: 620, patrolChance: 0.2, patrolSpeed: 235, chaseSpeed: 325, shootRange: 335, shotCooldownMs: 1_350, shotSpread: 55, humanHunterAmmo: 6, aiHunterAmmo: 14, rewardMultiplier: 1.6 },
};

export function difficultyMultiplier(difficulty: SoloDifficulty): number {
  return DIFFICULTY_TUNING[difficulty].movement;
}

export function collectibleInRange(player: { x: number; y: number }, node: { x: number; y: number }, maxDistance = 260): boolean {
  return Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(node.x) && Number.isFinite(node.y)
    && Math.hypot(player.x - node.x, player.y - node.y) <= maxDistance;
}

export interface NpcSeed {
  id: number;
  x: number;
  y: number;
  animalType: AnimalType;
}

interface RoomState {
  phase: GamePhase;
  players: PlayerState[];
  npcSeeds: NpcSeed[];
  hunterId: string | null;
  ammo: number;
  maxAmmo: number;
  timeRemaining: number;
  matchDuration: number;
  matchStartTime: number;
  countdownEndsAt: number | null;
  winner: "hunter" | "animals" | null;
  eventLog: string[];
  isSoloMode: boolean;
  levelId: LevelId;
  hostUserId: string | null;
  maxPlayers: number;
  createdAt: number;
  closed: boolean;
  soloDifficulty: SoloDifficulty;
}

// ── Open-world shared types ──────────────────────────────────────────────────
export type GameMode = "match" | "openWorld";
export type ZoneId = "savannahReserve";
export type DistrictId =
  | "lodge" | "grasslands" | "wateringHole" | "ridgeTrail" | "acaciaGrove" | "moonfernForest" | "strikerField";

export type QuestId =
  | "daily_scout_tracks"
  | "daily_collect_tokens"
  | "daily_blend_herd"
  | "repeat_gather_food"
  | "repeat_camera_tag"
  | "repeat_water_run";

export type QuestStatus = "available" | "active" | "complete" | "claimed";

export type QuestObjective =
  | "collect" | "visit" | "camera_tag" | "survive_timer" | "blend_near_herd";

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
  animalType: AnimalType;
  selectedCosmetic: string | null;
  level: number;
}

export interface CollectibleNode {
  id: string;
  x: number;
  y: number;
  kind: "coin" | "token" | "supply" | "track";
  value: number;
  respawnAt?: number;
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

// Open-world quest catalog (server-authoritative).
const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: "repeat_gather_food",
    title: "Gather Food",
    description: "Collect 5 food/supply nodes around the reserve.",
    objectiveType: "collect",
    targetCount: 5,
    reward: { coins: 25, xp: 20 },
    daily: false,
  },
  {
    id: "repeat_camera_tag",
    title: "Camera Tag",
    description: "Visit 3 wildlife camera points.",
    objectiveType: "camera_tag",
    targetCount: 3,
    reward: { coins: 35, xp: 30 },
    daily: false,
  },
  {
    id: "repeat_water_run",
    title: "Water Run",
    description: "Visit the watering hole and return to the lodge.",
    objectiveType: "visit",
    targetCount: 2,
    reward: { coins: 30, xp: 25 },
    daily: false,
  },
  {
    id: "daily_scout_tracks",
    title: "Scout Tracks",
    description: "Collect 6 track nodes. Resets daily (UTC).",
    objectiveType: "collect",
    targetCount: 6,
    reward: { coins: 75, xp: 60 },
    daily: true,
  },
  {
    id: "daily_collect_tokens",
    title: "Reserve Cleanup",
    description: "Collect 10 scattered supply nodes. Resets daily (UTC).",
    objectiveType: "collect",
    targetCount: 10,
    reward: { coins: 100, xp: 80, badges: 1 },
    daily: true,
  },
  {
    id: "daily_blend_herd",
    title: "Blend With Herd",
    description: "Spend 30s near an ambient herd without sprinting. Resets daily (UTC).",
    objectiveType: "blend_near_herd",
    targetCount: 30,
    reward: { coins: 60, xp: 50 },
    daily: true,
  },
];

export function questById(id: QuestId): QuestDefinition | undefined {
  return QUEST_CATALOG.find((q) => q.id === id);
}

const OW_WORLD_SIZE = 6000;
const COLLECTIBLE_RESPAWN_MS = 30_000;
const OW_LAYOUT_VERSION = 2;

export function questCatalogForTest(): readonly QuestDefinition[] { return QUEST_CATALOG; }

// Deterministic UTC date key, e.g. "2026-07-10". Used for daily-quest reset.
export function dailyQuestDateUTC(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

// Deterministic collectible layout for a zone + daily seed (so all clients and
// the server agree on node positions; nodes respawn in place).
function seededPrng(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = Math.imul(a ^ (a >>> 16), 2246822507);
    t = Math.imul(t ^ (t >>> 13), 3266489917);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}

const DISTRICTS: { id: DistrictId; cx: number; cy: number; spread: number }[] = [
  { id: "lodge", cx: 3000, cy: 3000, spread: 260 },
  { id: "grasslands", cx: 1300, cy: 3200, spread: 980 },
  { id: "wateringHole", cx: 4750, cy: 4450, spread: 460 },
  { id: "ridgeTrail", cx: 3100, cy: 750, spread: 620 },
  { id: "acaciaGrove", cx: 4750, cy: 1450, spread: 620 },
  { id: "moonfernForest", cx: 1050, cy: 1050, spread: 760 },
  { id: "strikerField", cx: 4750, cy: 3000, spread: 480 },
];

function generateCollectibles(zoneId: ZoneId, dailySeed: string): CollectibleNode[] {
  const rnd = seededPrng(`${zoneId}:${dailySeed}`);
  const kinds: CollectibleNode["kind"][] = ["coin", "token", "supply", "track"];
  const valueFor = (k: CollectibleNode["kind"]) =>
    k === "coin" ? 5 : k === "token" ? 10 : k === "supply" ? 15 : 20;
  const nodes: CollectibleNode[] = [];
  let n = 0;
  for (const d of DISTRICTS) {
    const count = d.id === "grasslands" ? 22 : d.id === "wateringHole" ? 12 : d.id === "lodge" ? 8 : 14;
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const angle = i / count * Math.PI * 2 + rnd() * 0.22;
      const lodgeRadius = 82 + (i % 3) * 48;
      const x = d.id === "lodge"
        ? d.cx + Math.cos(angle) * lodgeRadius
        : Math.max(80, Math.min(OW_WORLD_SIZE - 80, d.cx + (rnd() - 0.5) * d.spread * 2));
      const y = d.id === "lodge"
        ? d.cy + Math.sin(angle) * lodgeRadius
        : Math.max(80, Math.min(OW_WORLD_SIZE - 80, d.cy + (rnd() - 0.5) * d.spread * 2));
      nodes.push({
        id: `${zoneId}:${dailySeed}:${n++}`,
        x: Math.round(x),
        y: Math.round(y),
        kind,
        value: valueFor(kind),
      });
    }
  }
  return nodes;
}

// ── Match-mode message types ─────────────────────────────────────────────────
interface ClientMessage {
  type: "READY" | "SYNC" | "SHOOT" | "SELECT_ANIMAL" | "SELECT_PERK" | "ACTIVATE_PERK" | "RESTART" | "SET_DURATION" | "START_SOLO" | "SELECT_LEVEL" | "ADMIN_AUTH" | "ADMIN_CMD" | "LEAVE_ROOM" | "CLOSE_ROOM";
  payload?: {
    role?: "hunter" | "animal" | "random";
    botCount?: number;
    levelId?: LevelId;
    animalType?: AnimalType;
    isReady?: boolean;
    perk?: PerkType;
    x?: number;
    y?: number;
    targetX?: number;
    targetY?: number;
    duration?: number;
    adminKey?: string;
    command?: string;
    targetId?: string;
    sequence?: number;
    timestamp?: number;
    difficulty?: SoloDifficulty;
  };
}

interface ServerMessage {
  type: "SYNC_STATE" | "MATCH_START" | "HIT" | "GAME_OVER" | "DECOY_SPAWN" | "ADMIN_OK" | "ADMIN_DENIED" | "ADMIN_LOG";
  payload: any;
}

// ── Open-world message types ─────────────────────────────────────────────────
interface OpenWorldClientMessage {
  type:
    | "OPEN_WORLD_JOIN"
    | "OPEN_WORLD_LEAVE"
    | "OPEN_WORLD_SYNC"
    | "QUEST_ACCEPT"
    | "QUEST_PROGRESS"
    | "QUEST_CLAIM"
    | "COLLECT_NODE";
  payload?: {
    zoneId?: ZoneId;
    userId?: string;
    username?: string;
    x?: number;
    y?: number;
    animalType?: AnimalType;
    questId?: QuestId;
    amount?: number;
    nodeId?: string;
    evidence?: unknown;
  };
}

interface OpenWorldServerMessage {
  type:
    | "OPEN_WORLD_STATE"
    | "PROFILE_SYNC"
    | "QUEST_UPDATED"
    | "REWARD_GRANTED"
    | "COLLECTIBLE_COLLECTED"
    | "OPEN_WORLD_ERROR";
  payload: any;
}

// ── Environment / persistence interfaces ─────────────────────────────────────
interface Env {
  GAME_ROOM: DurableObjectNamespace;
  SOCCER_ROOM: DurableObjectNamespace;
  PLAYER_PROFILE: DurableObjectNamespace;
  OPEN_WORLD_ZONE: DurableObjectNamespace;
  ROOM_DIRECTORY: DurableObjectNamespace;
  ADMIN_KEY?: string;
  INTERNAL_REWARD_SECRET?: string;
}

export interface PlayerProfile {
  userId: string;
  username: string;
  xp: number;
  level: number;
  coins: number;
  badges: number;
  ownedCosmetics: string[];
  selectedCosmetic: string | null;
  unlockedAbilities: string[];
  questProgress: Record<string, QuestProgress>;
  dailyQuestDate: string;
  openWorld: {
    lastZoneId: ZoneId | null;
    lastX: number;
    lastY: number;
    discoveredZones: ZoneId[];
    collectedNodeIds: string[];
  };
  stats: {
    matches: number;
    wins: number;
    losses: number;
    tags: number;
    survivals: number;
    openWorldMinutes: number;
    questsCompleted: number;
    collectiblesFound: number;
  };
  economyLedger: import("./economy").EconomyLedgerEntry[];
  settings: Record<string, unknown>;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

interface AdminAuditEntry {
  ts: number;
  adminId: string;
  action: string;
  detail: string;
}

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type, x-internal-reward-secret, authorization",
};

// ── Structured, bounded diagnostics logging (no personal data beyond ids) ─────
function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  try {
    // Bound the event object so logging can never leak oversized payloads.
    const safe: Record<string, unknown> = { event, timestamp: Date.now() };
    for (const [k, v] of Object.entries(fields)) {
      if (k === "state" || k === "profile") continue; // never log full snapshots
      safe[k] = v;
    }
    console.log(JSON.stringify(safe));
  } catch {
    /* logging must never crash the request path */
  }
}

// ── Profile Durable Object (authoritative wallet/ledger) ─────────────────────
import {
  newProfile,
  applyReward,
  applyPurchase,
  applySelect,
  applyAdminGrant,
  requireInternalRewardAuth,
  requireAdminKey,
  trimLedger,
  applyQuestClaim,
  collectibleGrantable,
  dueDailyReset,
  type EconomyLedgerEntry,
  type MatchStats,
} from "./economy";

export { RoomDirectoryDurableObject } from "./roomDirectory";

export class PlayerProfileDurableObject implements DurableObject {
  constructor(public ctx: DurableObjectState, public env: Env) {}

  private async load(userId: string, username?: string): Promise<PlayerProfile> {
    let profile = (await this.ctx.storage.get<PlayerProfile>("profile")) ?? null;
    if (!profile) {
      profile = newProfile(userId, username ?? "Anonymous") as PlayerProfile;
      await this.ctx.storage.put("profile", profile);
    } else if (username && username !== profile.username) {
      profile.username = username;
    }
    return profile;
  }

  private async save(profile: PlayerProfile): Promise<void> {
    profile.updatedAt = Date.now();
    trimLedger(profile, 200);
    await this.ctx.storage.put("profile", profile);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "get";
    const userId = url.searchParams.get("userId") ?? "unknown";
    const username = url.searchParams.get("username") ?? undefined;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const profile = await this.load(userId, username);

    if (action === "get") {
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    // ⛔ Server-only: match rewards / quest claims / collectibles. Requires the
    // internal reward secret. The browser can never satisfy this.
    if (action === "reward" && request.method === "POST") {
      if (!requireInternalRewardAuth(request, this.env)) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: JSON_HEADERS });
      }
      const body = (await request.json().catch(() => ({}))) as {
        coins?: number; badges?: number; xp?: number; stat?: Partial<MatchStats>;
        source?: import("./economy").LedgerSource; metadata?: Record<string, unknown>;
      };
      applyReward(profile, body);
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    // Public: purchase a valid shop item with the player's own balance.
    if (action === "purchase" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { cosmeticId?: string };
      const result = applyPurchase(profile, body.cosmeticId ?? "");
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error, profile }), { status: 400, headers: JSON_HEADERS });
      }
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    // Public: select an already-owned cosmetic (preference only).
    if (action === "select" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { cosmeticId?: string | null };
      if (!applySelect(profile, body.cosmeticId ?? null)) {
        return new Response(JSON.stringify({ error: "not_owned", profile }), { status: 400, headers: JSON_HEADERS });
      }
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    // ⛔ Admin-only: requires the ADMIN_KEY secret. Disabled if unset.
    if (action === "admin-grant" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        key?: string; coins?: number; badges?: number; xp?: number; makeAdmin?: boolean;
      };
      if (!requireAdminKey(body.key, this.env)) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: JSON_HEADERS });
      }
      applyAdminGrant(profile, body);
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    // ⛔ Server-only: open-world progression + optional reward. Requires the
    // internal reward secret. This is the ONLY write path for quest progress,
    // discovered zones, and open-world stats.
    if (action === "ow_sync" && request.method === "POST") {
      if (!requireInternalRewardAuth(request, this.env)) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: JSON_HEADERS });
      }
      const body = (await request.json().catch(() => ({}))) as {
        questProgress?: Record<string, QuestProgress>;
        openWorld?: Partial<PlayerProfile["openWorld"]> & { discoveredZones?: ZoneId[] };
        stats?: Partial<PlayerProfile["stats"]>;
        reward?: { coins?: number; badges?: number; xp?: number; metadata?: Record<string, unknown> };
      };
      if (body.questProgress) {
        for (const [qid, qp] of Object.entries(body.questProgress)) {
          profile.questProgress[qid] = qp;
        }
      }
      if (body.openWorld) {
        profile.openWorld = { ...profile.openWorld, ...body.openWorld } as PlayerProfile["openWorld"];
      }
      if (body.stats) {
        Object.assign(profile.stats, body.stats);
      }
      if (body.reward) {
        applyReward(profile, {
          coins: body.reward.coins,
          badges: body.reward.badges,
          xp: body.reward.xp,
          source: "quest_reward",
          metadata: body.reward.metadata,
        });
      }
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: JSON_HEADERS });
  }
}

// ── Match-mode room ───────────────────────────────────────────────────────────
const WORLD_SIZE = 2800;
const PLAYER_COLLISION_RADIUS = 34;
const MATCH_DURATION_DEFAULT = 120;
const MATCH_DURATION_MIN = 30;
const MATCH_DURATION_MAX = 3600;

const ALL_ANIMALS: AnimalType[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
  "fish", "turtle", "crab", "octopus",
  "jellyfish", "shark", "seahorse", "stingray",
  "zebra", "gazelle", "wildebeest", "warthog",
  "ostrich", "meerkat", "hyena", "secretarybird",
];

function randomAnimal(roster?: AnimalType[]): AnimalType {
  const pool = roster && roster.length ? roster : ALL_ANIMALS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function randomAnimalExcept(current: AnimalType, roster?: AnimalType[]): AnimalType {
  const pool = roster && roster.length ? roster : ALL_ANIMALS;
  const available = pool.filter((a) => a !== current);
  return available[Math.floor(Math.random() * available.length)];
}
function generateNpcSeeds(count: number, roster?: AnimalType[]): NpcSeed[] {
  const seeds: NpcSeed[] = [];
  const pool = roster && roster.length ? roster : ALL_ANIMALS;
  for (let i = 0; i < count; i++) {
    seeds.push({
      id: i,
      x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
      y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
      animalType: randomAnimal(pool),
    });
  }
  return seeds;
}
function npcCountForPlayers(playerCount: number): number {
  if (playerCount <= 2) return 45;
  return Math.min(80, 50 + playerCount * 8);
}

export class GameRoomDurableObject implements DurableObject {
  state: RoomState;
  syncInterval: ReturnType<typeof setInterval> | null = null;
  countdownInterval: ReturnType<typeof setInterval> | null = null;
  autoResetTimeout: ReturnType<typeof setTimeout> | null = null;
  rewardsGranted = false;
  hunterTagCount = 0;
  adminConns = new Set<string>();
  auditLog: AdminAuditEntry[] = [];
  private readonly sockets = new Set<WebSocket>();
  private readonly socketAttachments = new WeakMap<WebSocket, { userId: string; username: string; connectionId: string }>();
  private directoryRoomId: string | null = null;
  private lastDirectorySnapshot = "";

  private static readonly STORAGE_KEY = "room_snapshot_v1";

  constructor(public ctx: DurableObjectState, public env: Env) {
    this.state = {
      phase: "LOBBY", players: [], npcSeeds: [], hunterId: null, ammo: 0, maxAmmo: 0,
      timeRemaining: MATCH_DURATION_DEFAULT, matchDuration: MATCH_DURATION_DEFAULT,
      matchStartTime: 0, countdownEndsAt: null, winner: null, eventLog: [], isSoloMode: false,
      levelId: "forest", hostUserId: null, maxPlayers: MAX_PLAYERS_DEFAULT, createdAt: Date.now(),
      closed: false,
      soloDifficulty: "normal",
    };
    const concurrencyGuard = (ctx as DurableObjectState & { blockConcurrencyWhile?: (callback: () => Promise<void>) => Promise<void> }).blockConcurrencyWhile;
    if (concurrencyGuard) {
      void concurrencyGuard.call(ctx, async () => {
        const stored = await ctx.storage.get<{ state: RoomState; rewardsGranted: boolean; hunterTagCount: number; auditLog: AdminAuditEntry[] }>(GameRoomDurableObject.STORAGE_KEY);
        if (!stored) return;
        this.state = { ...this.state, ...stored.state };
        this.rewardsGranted = stored.rewardsGranted;
        this.hunterTagCount = stored.hunterTagCount;
        this.auditLog = Array.isArray(stored.auditLog) ? stored.auditLog.slice(-100) : [];
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    this.directoryRoomId = url.searchParams.get("room")?.trim().toUpperCase() || null;
    const directoryMaxPlayers = Number(request.headers.get("x-room-max-players"));
    if (Number.isInteger(directoryMaxPlayers) && directoryMaxPlayers >= 2 && directoryMaxPlayers <= 12) {
      this.state.maxPlayers = directoryMaxPlayers;
    }
    const userId = url.searchParams.get("userId") || crypto.randomUUID();
    const username = url.searchParams.get("username") || "Anonymous";
    const connectionId = crypto.randomUUID();

    if (this.state.closed) {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].close(4001, "room_closed");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (this.state.players.length >= this.state.maxPlayers && !this.state.players.some((p) => p.id === userId)) {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].close(4002, "room_full");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.add(server);
    this.socketAttachments.set(server, { userId, username, connectionId });
    server.addEventListener("message", (event) => this.webSocketMessage(server, event.data));
    server.addEventListener("close", (event) => this.webSocketClose(server, event.code, event.reason, event.wasClean));
    server.addEventListener("error", (event) => this.webSocketError(server, event));
    this.addPlayer(userId, username, connectionId);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    const attachment = this.attachmentFor(ws);
    if (!attachment) return;
    const userId = attachment.userId;
    const connectionId = attachment.connectionId;
    let parsed: ClientMessage;
    try { parsed = JSON.parse(message as string); } catch { return; }

    if (parsed.type === "ADMIN_AUTH") {
      this.handleAdminAuth(ws, connectionId, userId, attachment.username, parsed.payload?.adminKey);
      return;
    }
    if (parsed.type === "ADMIN_CMD") {
      this.handleAdminCommand(ws, connectionId, userId, parsed.payload ?? {});
      return;
    }

    const player = this.state.players.find((p) => p.id === userId);
    if (!player) return;

    switch (parsed.type) {
      case "READY":
        if (this.state.phase !== "LOBBY" && this.state.phase !== "COUNTDOWN") break;
        player.isReady = resolveReadyState(player.isReady, parsed.payload?.isReady, this.state.phase);
        logEvent("ready", { roomId: this.roomId(), userId, isReady: player.isReady });
        this.broadcastState();
        if (this.state.phase === "COUNTDOWN") {
          const humans = this.state.players.filter((p) => !p.isBot);
          if (humans.length < 2 || !humans.every((p) => p.isReady)) {
            this.state.phase = "LOBBY";
            this.state.countdownEndsAt = null;
            this.state.eventLog.unshift("Countdown canceled: not all players ready.");
            this.state.eventLog = this.state.eventLog.slice(0, 8);
            this.broadcastState();
          }
        } else {
          this.tryStartMatch();
        }
        break;
      case "SELECT_ANIMAL":
        if (this.state.phase === "LOBBY") {
          const choice = parsed.payload?.animalType as AnimalType | undefined;
          if (choice && isAnimalAllowed(choice, this.state.levelId)) player.animalType = choice;
          this.broadcastState();
        }
        break;
      case "SELECT_LEVEL": {
        if (this.state.phase !== "LOBBY") { logEvent("level_selection_rejected", { roomId: this.roomId(), userId, phase: this.state.phase }); break; }
        const requested = parsed.payload?.levelId;
        if (!isValidLevelId(requested)) { logEvent("level_selection_rejected", { roomId: this.roomId(), userId, reason: "invalid_level" }); break; }
        logEvent("level_selected", { roomId: this.roomId(), userId, requested });
        if (requested === this.state.levelId) { this.broadcastState(); break; }
        this.state.levelId = requested;
        for (const p of this.state.players) {
          if (!p.isBot && !isAnimalAllowed(p.animalType, this.state.levelId)) {
            p.animalType = defaultAnimalForLevel(this.state.levelId);
          }
        }
        this.state.players = this.state.players.filter((p) => !p.isBot);
        this.state.npcSeeds = [];
        this.broadcastState();
        break;
      }
      case "SELECT_PERK":
        if (this.state.phase === "LOBBY") { player.perk = parsed.payload?.perk ?? "none"; this.broadcastState(); }
        break;
      case "SYNC":
        if (this.state.phase === "PLAYING" && player.isAlive) {
          const { x, y, sequence } = parsed.payload || {};
          if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
            const now = Date.now();
            if (typeof sequence === "number" && sequence <= (player.lastMoveSequence ?? -1)) break;
            if (player.perk === "camouflage" && (player.perkActiveUntil ?? 0) > now) break;
            const elapsed = player.lastMoveAt ? Math.max(16, now - player.lastMoveAt) : 50;
            const maxDistance = allowedMovementDistance(player, now, elapsed) * 1.35 + 8;
            const targetX = Math.max(0, Math.min(WORLD_SIZE, x));
            const targetY = Math.max(0, Math.min(WORLD_SIZE, y));
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= maxDistance) {
              player.x = targetX;
              player.y = targetY;
            } else if (distance > 0) {
              player.x += (dx / distance) * maxDistance;
              player.y += (dy / distance) * maxDistance;
            }
            player.lastMoveAt = now;
            if (typeof sequence === "number") player.lastMoveSequence = sequence;
          }
        }
        break;
      case "ACTIVATE_PERK": {
        if (this.state.phase !== "PLAYING" || !player.isAlive || player.isHunter || parsed.payload?.perk !== player.perk) break;
        const result = activatePerk(player, Date.now());
        if (result.ok) {
          if (result.effect === "decoy") {
            this.broadcast({ type: "DECOY_SPAWN", payload: { x: player.x, y: player.y, animalType: player.animalType, ownerId: userId, expiresAt: player.perkActiveUntil } });
          }
          this.broadcastState();
        }
        break;
      }
      case "SHOOT":
        if (this.state.phase === "PLAYING" && player.isHunter) this.handleShoot(player, parsed.payload);
        break;
      case "RESTART":
        if (this.state.phase === "ENDED") { this.resetRoom(); this.broadcastState(); }
        break;
      case "START_SOLO":
        if (this.state.phase === "LOBBY" && !player.isBot) {
          let role: "hunter" | "animal" | "random";
          if (parsed.payload?.role === "hunter") role = "hunter";
          else if (parsed.payload?.role === "animal") role = "animal";
          else role = "random";
          const botCount = parsed.payload?.botCount ?? 4;
          const difficulty = parsed.payload?.difficulty === "easy" || parsed.payload?.difficulty === "hard" ? parsed.payload.difficulty : "normal";
          this.startSoloMatch(userId, role, botCount, difficulty);
        }
        break;
      case "SET_DURATION":
        if (this.state.phase === "LOBBY") {
          const raw = parsed.payload?.duration;
          if (typeof raw === "number") {
            const clamped = Math.max(MATCH_DURATION_MIN, Math.min(MATCH_DURATION_MAX, Math.round(raw)));
            this.state.matchDuration = clamped;
            this.state.timeRemaining = clamped;
            this.broadcastState();
          }
        }
        break;
      case "LEAVE_ROOM":
        this.removePlayer(userId);
        for (const ws of this.allSockets()) {
          const att = this.attachmentFor(ws);
          if (att?.userId === userId) { try { ws.close(1000, "client_leave"); } catch { /* ignore */ } }
        }
        break;
      case "CLOSE_ROOM":
        if (this.state.hostUserId === userId) {
          this.state.closed = true;
          logEvent("room_closed", { roomId: this.roomId(), by: userId });
          for (const ws of this.allSockets()) { try { ws.close(4001, "room_closed"); } catch { /* ignore */ } }
          this.resetRoom();
          this.state.closed = true;
          this.notifyDirectory(true);
        }
        break;
    }
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    const attachment = this.attachmentFor(ws);
    if (!attachment) return;
    this.sockets.delete(ws);
    this.adminConns.delete(attachment.connectionId);
    this.removePlayer(attachment.userId, attachment.connectionId);
    if (this.state.players.length === 0) this.stopLoops();
  }
  webSocketError(ws: WebSocket, _error: unknown): void {
    const attachment = this.attachmentFor(ws);
    if (!attachment) return;
    this.sockets.delete(ws);
    this.removePlayer(attachment.userId, attachment.connectionId);
  }

  private roomId(): string {
    if (this.directoryRoomId) return this.directoryRoomId;
    // Best-effort room label for logs (derived from the DO id name).
    try {
      return this.ctx.id.toString();
    } catch {
      return this.state.isSoloMode ? "solo" : "match";
    }
  }

  addPlayer(id: string, username: string, connectionId: string) {
    if (this.state.isSoloMode && this.state.phase === "PLAYING") {
      const anyHuman = this.state.players.some((p) => !p.isBot);
      if (!anyHuman) this.resetRoom();
    }
    const existing = this.state.players.find((p) => p.id === id);
    if (!existing) {
      const roster = animalsForLevel(this.state.levelId);
      if (this.state.hostUserId === null) this.state.hostUserId = id;
      this.state.players.push({
        id, username, x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50, y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        animalType: randomAnimal(roster), isHunter: false, isReady: false, isAlive: true, perk: "none", extraLifeUsed: false, connId: connectionId,
      });
      logEvent("join", { roomId: this.roomId(), userId: id, isSolo: this.state.isSoloMode });
    } else {
      existing.isAlive = true; existing.isReady = false; existing.connId = connectionId;
      if (!isAnimalAllowed(existing.animalType, this.state.levelId)) existing.animalType = defaultAnimalForLevel(this.state.levelId);
      if (this.state.phase === "PLAYING" || this.state.phase === "COUNTDOWN") {
        logEvent("reconnect", { roomId: this.roomId(), userId: id });
      }
    }
    this.broadcastState();
  }
  removePlayer(id: string, closingConnId?: string) {
    const player = this.state.players.find((p) => p.id === id);
    if (player && closingConnId && player.connId && player.connId !== closingConnId) return;
    this.state.players = this.state.players.filter((p) => p.id !== id);
    logEvent("leave", { roomId: this.roomId(), userId: id });

    // Host transfer: if the host left and humans remain, promote the first human.
    if (this.state.hostUserId === id) {
      const nextHost = this.state.players.find((p) => !p.isBot);
      this.state.hostUserId = nextHost ? nextHost.id : null;
      if (nextHost) this.state.eventLog.unshift(`${nextHost.username} is now the host.`);
    }

    if (this.state.isSoloMode) {
      const humansLeft = this.state.players.some((p) => !p.isBot);
      if (!humansLeft) { this.resetRoom(); this.broadcastState(); return; }
    }
    if (this.state.phase === "PLAYING") {
      if (this.state.hunterId === id) this.endGame("animals", "Hunter disconnected!");
      else if (this.state.players.length < 2) this.endGame("animals", "Not enough players to continue!");
      else this.checkWinCondition();
    } else if (this.state.phase === "COUNTDOWN") {
      const humans = this.state.players.filter((p) => !p.isBot);
      if (humans.length < 2 || !humans.every((p) => p.isReady)) {
        this.state.phase = "LOBBY";
        this.state.countdownEndsAt = null;
        this.state.eventLog.unshift("Countdown canceled: not enough ready players.");
        this.state.eventLog = this.state.eventLog.slice(0, 8);
        this.broadcastState();
      }
    }
    this.broadcastState();
  }

  tryStartMatch() {
    if (this.state.phase !== "LOBBY") return;
    const humans = this.state.players.filter((p) => !p.isBot);
    if (humans.length < 2) return;
    if (!humans.every((p) => p.isReady)) return;
    const players = this.state.players;
    const hunterIndex = Math.floor(Math.random() * players.length);
    const hunterId = players[hunterIndex].id;
    players.forEach((p, i) => {
      p.isHunter = i === hunterIndex; p.isAlive = true; p.extraLifeUsed = false;
      const spawn = safeMatchSpawn(i); p.x = spawn.x; p.y = spawn.y;
      if (!p.isHunter && !isAnimalAllowed(p.animalType, this.state.levelId)) p.animalType = defaultAnimalForLevel(this.state.levelId);
    });
    this.state.hunterId = hunterId;
    const animalCount = players.length - 1;
    this.state.ammo = animalCount * 10; this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length), animalsForLevel(this.state.levelId));
    // Server-owned synchronized countdown before gameplay begins.
    this.state.phase = "COUNTDOWN";
    this.state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.state.timeRemaining = this.state.matchDuration;
    this.state.winner = null; this.rewardsGranted = false; this.hunterTagCount = 0;
    this.state.eventLog = [`Get ready! ${animalCount} animal(s) hiding.`];
    logEvent("match_start", { roomId: this.roomId(), playerCount: humans.length, levelId: this.state.levelId });
    this.broadcastState();
    this.startCountdown();
  }

  private beginPlaying() {
    if (this.state.phase !== "COUNTDOWN") return;
    this.state.phase = "PLAYING";
    this.state.players.forEach((player) => { player.isReady = false; });
    this.state.countdownEndsAt = null;
    this.state.matchStartTime = Date.now();
    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
    this.notifyDirectory();
    this.startSyncLoop();
  }

  handleShoot(hunter: PlayerState, payload: any) {
    if (this.state.phase !== "PLAYING") return;
    const { targetX, targetY } = payload || {};
    if (typeof targetX !== "number" || typeof targetY !== "number") return;
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
    if (targetX < 0 || targetX > WORLD_SIZE || targetY < 0 || targetY > WORLD_SIZE) return;
    if (this.state.ammo <= 0) return;
    const now = Date.now();
    if (now - (hunter.lastShotAt ?? 0) < 220) return;
    hunter.lastShotAt = now;
    this.state.ammo -= 1;
    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) {
      if (p.isHunter || !p.isAlive) continue;
      const dx = targetX - p.x; const dy = targetY - p.y;
      if (Math.sqrt(dx * dx + dy * dy) <= PLAYER_COLLISION_RADIUS) { hitPlayer = p; break; }
    }
    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife") {
        const previousAnimal = hitPlayer.animalType;
        hitPlayer.animalType = randomAnimalExcept(previousAnimal, animalsForLevel(this.state.levelId));
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.perk = "none"; hitPlayer.extraLifeUsed = true;
        this.state.eventLog.unshift(`${hitPlayer.username}'s Extra Life activated! Respawned as ${hitPlayer.animalType}.`);
        this.state.eventLog = this.state.eventLog.slice(0, 8);
        this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true, extraLife: true, animalType: hitPlayer.animalType, x: hitPlayer.x, y: hitPlayer.y } });
        return;
      }
      hitPlayer.isAlive = false;
      this.state.eventLog.unshift(`${hitPlayer.username} was neutralized!`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.hunterTagCount += 1;
      this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true } });
      this.checkWinCondition();
    } else {
      this.state.eventLog.unshift(`Hunter missed! ${this.state.ammo} ammo left.`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.broadcast({ type: "HIT", payload: { targetId: null, targetX, targetY, hit: false } });
      if (this.state.ammo <= 0) this.endGame("animals", "Hunter ran out of ammo!");
    }
  }

  checkWinCondition() {
    const aliveAnimals = this.state.players.filter((p) => !p.isHunter && p.isAlive);
    if (aliveAnimals.length === 0) this.endGame("hunter", "All animals neutralized!");
  }

  endGame(winner: "hunter" | "animals", reason: string) {
    if (this.state.phase === "ENDED") return;
    this.state.phase = "ENDED"; this.state.winner = winner; this.state.timeRemaining = 0;
    this.state.eventLog.unshift(`Game Over: ${reason}`);
    this.state.eventLog = this.state.eventLog.slice(0, 10);
    this.stopLoops();
    this.grantMatchRewards(winner);
    logEvent("match_end", { roomId: this.roomId(), winner, reason, isSolo: this.state.isSoloMode });
    this.broadcast({ type: "GAME_OVER", payload: { winner, reason, state: this.serializeState() } });
    this.notifyDirectory();
    if (this.autoResetTimeout) clearTimeout(this.autoResetTimeout);
    this.autoResetTimeout = setTimeout(() => {
      this.autoResetTimeout = null;
      this.resetRoom();
      this.broadcastState();
    }, 5000);
  }

  grantMatchRewards(winner: "hunter" | "animals") {
    if (this.rewardsGranted) return;
    this.rewardsGranted = true;
    const humans = this.state.players.filter((p) => !p.isBot);
    for (const p of humans) {
      const isWinner = (winner === "hunter" && p.isHunter) || (winner === "animals" && !p.isHunter);
      let coins = 10; let xp = 15; let badges = 0;
      const stat: Partial<MatchStats> = { matches: 1 };
      if (p.isHunter) { coins += this.hunterTagCount * 8; xp += this.hunterTagCount * 10; stat.tags = this.hunterTagCount; }
      else if (p.isAlive) { coins += 15; xp += 20; stat.survivals = 1; }
      if (isWinner) { coins += 25; xp += 30; badges += 1; stat.wins = 1; }
      else stat.losses = 1;
      if (this.state.isSoloMode) {
        const soloScale = 0.5 * DIFFICULTY_TUNING[this.state.soloDifficulty].rewardMultiplier;
        coins = Math.floor(coins * soloScale); xp = Math.floor(xp * soloScale); badges = 0;
      }
      this.rewardProfile(p.id, p.username, { coins, xp, badges, stat, source: "match_reward" });
    }
  }

  async rewardProfile(
    userId: string, username: string,
    body: { coins: number; xp: number; badges: number; stat: Partial<MatchStats>; source?: import("./economy").LedgerSource },
  ) {
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      await stub.fetch(`https://profile/?action=reward&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-reward-secret": this.env.INTERNAL_REWARD_SECRET ?? "" },
        body: JSON.stringify(body),
      });
    } catch {
      // Reward persistence is best-effort; never block match flow.
    }
  }

  // ── Admin control plane (server-authoritative) ─────────────────────────────
  private async loadAudit(): Promise<void> {
    if (this.auditLog.length) return;
    const stored = await this.ctx.storage.get<AdminAuditEntry[]>("auditLog");
    if (stored) this.auditLog = stored;
  }
  private async pushAudit(adminId: string, action: string, detail: string) {
    await this.loadAudit();
    this.auditLog.unshift({ ts: Date.now(), adminId, action, detail });
    this.auditLog = this.auditLog.slice(0, 100);
    await this.ctx.storage.put("auditLog", this.auditLog);
  }
  private sendTo(ws: WebSocket, msg: ServerMessage) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }

  async handleAdminAuth(ws: WebSocket, connectionId: string, userId: string, username: string, key?: string) {
    if (!requireAdminKey(key, this.env)) {
      this.sendTo(ws, { type: "ADMIN_DENIED", payload: {} });
      return;
    }
    this.adminConns.add(connectionId);
    await this.loadAudit();
    await this.pushAudit(userId, "ADMIN_LOGIN", `${username} authenticated`);
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      await stub.fetch(
        `https://profile/?action=admin-grant&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, makeAdmin: true }) },
      );
    } catch { /* best-effort */ }
    this.sendTo(ws, { type: "ADMIN_OK", payload: { auditLog: this.auditLog, state: this.serializeState() } });
  }

  async handleAdminCommand(ws: WebSocket, connectionId: string, userId: string, payload: { command?: string; levelId?: LevelId; duration?: number; targetId?: string; botCount?: number }) {
    if (!this.adminConns.has(connectionId)) { this.sendTo(ws, { type: "ADMIN_DENIED", payload: {} }); return; }
    const cmd = payload.command;
    switch (cmd) {
      case "reset_room": this.resetRoom(); await this.pushAudit(userId, "RESET_ROOM", "Room reset to lobby"); this.broadcastState(); break;
      case "end_match": if (this.state.phase === "PLAYING") { this.endGame("animals", "Match ended by admin"); await this.pushAudit(userId, "END_MATCH", "Force-ended match"); } break;
      case "force_start": if (this.state.phase === "LOBBY") { for (const p of this.state.players) if (!p.isBot) p.isReady = true; this.broadcastState(); this.tryStartMatch(); await this.pushAudit(userId, "FORCE_START", "Forced match start"); } break;
      case "set_level": if (this.state.phase === "LOBBY" && isValidLevelId(payload.levelId)) { this.state.levelId = payload.levelId; for (const p of this.state.players) { if (!p.isBot && !isAnimalAllowed(p.animalType, this.state.levelId)) p.animalType = defaultAnimalForLevel(this.state.levelId); } this.state.players = this.state.players.filter((p) => !p.isBot); await this.pushAudit(userId, "SET_LEVEL", `Level -> ${payload.levelId}`); this.broadcastState(); } break;
      case "set_duration": if (this.state.phase === "LOBBY" && typeof payload.duration === "number") { const c = Math.max(MATCH_DURATION_MIN, Math.min(MATCH_DURATION_MAX, Math.round(payload.duration))); this.state.matchDuration = c; this.state.timeRemaining = c; await this.pushAudit(userId, "SET_DURATION", `Duration -> ${c}s`); this.broadcastState(); } break;
      case "kick": {
        const targetId = payload.targetId;
        if (targetId) {
          for (const sock of this.allSockets()) {
            const att = this.attachmentFor(sock);
            if (att?.userId === targetId) { try { sock.close(1000, "Removed by admin"); } catch { /* ignore */ } }
          }
          this.state.players = this.state.players.filter((p) => p.id !== targetId);
          await this.pushAudit(userId, "KICK", `Removed player ${targetId}`);
          this.broadcastState();
        }
        break;
      }
      case "clear_bots": this.state.players = this.state.players.filter((p) => !p.isBot); await this.pushAudit(userId, "CLEAR_BOTS", "Removed all bots"); this.broadcastState(); break;
      default: break;
    }
    this.sendTo(ws, { type: "ADMIN_LOG", payload: { auditLog: this.auditLog } });
  }

  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.state.phase === "PLAYING") {
        const now = Date.now();
        if (this.state.isSoloMode) this.updateBots(now);
        this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
      }
    }, 1000 / 30);
  }
  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      if (this.state.phase === "COUNTDOWN") {
        // Keep broadcasting the synchronized countdown so every client sees the
        // same 3 → 2 → 1 → HIDE! sequence derived from server time.
        this.broadcastState();
        if (this.state.countdownEndsAt !== null && Date.now() >= this.state.countdownEndsAt) {
          this.beginPlaying();
        }
        return;
      }
      if (this.state.phase !== "PLAYING") return;
      const elapsed = (Date.now() - this.state.matchStartTime) / 1000;
      if (elapsed >= this.state.matchDuration) { this.state.timeRemaining = 0; this.endGame("animals", "Time expired! Animals survived!"); return; }
      this.state.timeRemaining = this.state.matchDuration - Math.floor(elapsed);
    }, 250);
  }
  stopLoops() {
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }
  resetRoom() {
    if (this.autoResetTimeout) { clearTimeout(this.autoResetTimeout); this.autoResetTimeout = null; }
    this.stopLoops();
    this.state.phase = "LOBBY"; this.state.hunterId = null; this.state.ammo = 0; this.state.maxAmmo = 0;
    this.state.timeRemaining = this.state.matchDuration; this.state.winner = null; this.state.npcSeeds = [];
    this.state.eventLog = []; this.state.isSoloMode = false; this.state.countdownEndsAt = null;
    this.state.soloDifficulty = "normal";
    this.state.players = this.state.players.filter((p) => !p.isBot);
    this.state.players.forEach((p) => {
      p.isHunter = false; p.isReady = false; p.isAlive = true; p.perk = "none"; p.extraLifeUsed = false;
      p.perkActiveUntil = 0; p.perkCooldownUntil = 0; p.perkConsumed = false;
      p.lastMoveAt = undefined; p.lastMoveSequence = undefined; p.lastShotAt = undefined;
    });
  }
  serializeState() {
    return {
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id, username: p.username, x: p.x, y: p.y, animalType: p.animalType, isHunter: p.isHunter,
        isReady: p.isReady, isAlive: p.isAlive, perk: p.perk, extraLifeUsed: p.extraLifeUsed, isBot: p.isBot ?? false,
        perkActiveUntil: p.perkActiveUntil ?? 0, perkCooldownUntil: p.perkCooldownUntil ?? 0, perkConsumed: p.perkConsumed ?? false,
        connectionStatus: "connected" as const, joinedAt: this.state.createdAt, lastSeenAt: Date.now(),
      })),
      npcSeeds: this.state.npcSeeds, hunterId: this.state.hunterId, ammo: this.state.ammo, maxAmmo: this.state.maxAmmo,
      timeRemaining: this.state.timeRemaining, matchDuration: this.state.matchDuration, winner: this.state.winner,
      eventLog: this.state.eventLog, levelId: this.state.levelId,
      hostUserId: this.state.hostUserId, maxPlayers: this.state.maxPlayers, countdownEndsAt: this.state.countdownEndsAt,
    };
  }
  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.allSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }
  broadcastState() {
    this.persistState();
    this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
    this.notifyDirectory();
  }

  private notifyDirectory(closed = false): void {
    const namespace = this.env.ROOM_DIRECTORY;
    const roomId = this.directoryRoomId;
    if (!namespace || !roomId || roomId.startsWith("SOLO:")) return;
    const playerCount = this.state.players.filter((player) => !player.isBot).length;
    const snapshot = `${roomId}:${playerCount}:${this.state.phase}:${closed}`;
    if (snapshot === this.lastDirectorySnapshot) return;
    this.lastDirectorySnapshot = snapshot;
    try {
      const id = namespace.idFromName("global-room-directory");
      const stub = namespace.get(id);
      void stub.fetch("https://directory/internal/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, playerCount, phase: this.state.phase, closed }),
      }).catch((error) => {
        this.lastDirectorySnapshot = "";
        logEvent("room_directory_sync_failed", { roomId, detail: error instanceof Error ? error.message : "unknown" });
      });
    } catch (error) {
      this.lastDirectorySnapshot = "";
      logEvent("room_directory_sync_failed", { roomId, detail: error instanceof Error ? error.message : "unknown" });
    }
  }

  private persistState(): void {
    void this.ctx.storage.put(GameRoomDurableObject.STORAGE_KEY, {
      state: this.state,
      rewardsGranted: this.rewardsGranted,
      hunterTagCount: this.hunterTagCount,
      auditLog: this.auditLog.slice(-100),
    }).catch((error) => logEvent("room_persist_failed", { roomId: this.roomId(), detail: error instanceof Error ? error.message : "unknown" }));
  }

  private attachmentFor(ws: WebSocket): { userId: string; username: string; connectionId: string } | null {
    const current = this.socketAttachments.get(ws);
    if (current) return current;
    try { return ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null; } catch { return null; }
  }

  private allSockets(): WebSocket[] {
    const combined = new Set<WebSocket>(this.sockets);
    try { for (const socket of this.ctx.getWebSockets()) combined.add(socket); } catch { /* legacy hibernatable sockets only */ }
    return [...combined];
  }

  // ── Solo / Bot system ─────────────────────────────────────────────────────
  startSoloMatch(humanId: string, humanRole: "hunter" | "animal" | "random", botCount: number, difficulty: SoloDifficulty = "normal") {
    if (this.state.phase !== "LOBBY") return;
    const human = this.state.players.find((p) => p.id === humanId);
    if (!human) return;
    this.state.players = this.state.players.filter((p) => !p.isBot);
    const BOT_ANIMAL_TYPES: AnimalType[] = animalsForLevel(this.state.levelId);
    if (!isAnimalAllowed(human.animalType, this.state.levelId)) human.animalType = defaultAnimalForLevel(this.state.levelId);
    const finalRole = humanRole === "random" ? (Math.random() < 0.5 ? "hunter" : "animal") : humanRole;
    this.state.soloDifficulty = difficulty;
    if (finalRole === "hunter") {
      human.isHunter = true;
      const animalBots = Math.max(2, botCount - 1);
      for (let i = 0; i < animalBots; i++) {
        this.state.players.push({ id: `bot_animal_${i}_${Date.now()}`, username: `Animal ${i + 1}`, x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, animalType: BOT_ANIMAL_TYPES[i % BOT_ANIMAL_TYPES.length], isHunter: false, isReady: true, isAlive: true, perk: "none", extraLifeUsed: false, isBot: true, botVx: (Math.random() - 0.5) * 5, botVy: (Math.random() - 0.5) * 5, botLastDecision: 0, botLastShot: 0 });
      }
      this.state.hunterId = human.id;
    } else {
      human.isHunter = false;
      const botId = `bot_hunter_${Date.now()}`;
      this.state.players.push({ id: botId, username: "🤖 AI Hunter", x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, animalType: defaultAnimalForLevel(this.state.levelId), isHunter: true, isReady: true, isAlive: true, perk: "none", extraLifeUsed: false, isBot: true, botVx: 0, botVy: 0, botLastDecision: 0, botLastShot: 0 });
      this.state.hunterId = botId;
      const animalBots = Math.max(2, botCount - 1);
      for (let i = 0; i < animalBots; i++) {
        this.state.players.push({ id: `bot_animal_${i}_${Date.now()}`, username: `Animal ${i + 1}`, x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150, animalType: BOT_ANIMAL_TYPES[i % BOT_ANIMAL_TYPES.length], isHunter: false, isReady: true, isAlive: true, perk: "none", extraLifeUsed: false, isBot: true, botVx: (Math.random() - 0.5) * 5, botVy: (Math.random() - 0.5) * 5, botLastDecision: 0, botLastShot: 0 });
      }
    }
    human.isAlive = true; human.isReady = false; human.extraLifeUsed = false;
    this.state.players.forEach((player, index) => { const spawn = safeMatchSpawn(index); player.x = spawn.x; player.y = spawn.y; });
    const animalCount = this.state.players.filter((p) => !p.isHunter).length;
    const tuning = DIFFICULTY_TUNING[difficulty];
    const ammoPerAnimal = finalRole === "hunter" ? tuning.humanHunterAmmo : tuning.aiHunterAmmo;
    this.state.ammo = animalCount * ammoPerAnimal; this.state.maxAmmo = this.state.ammo;
    const densityScale = finalRole === "hunter" ? (difficulty === "hard" ? 1.35 : difficulty === "easy" ? 0.72 : 1) : 1;
    this.state.npcSeeds = generateNpcSeeds(Math.round(npcCountForPlayers(this.state.players.length) * densityScale), animalsForLevel(this.state.levelId));
    this.state.winner = null; this.state.isSoloMode = true; this.rewardsGranted = false; this.hunterTagCount = 0;
    this.state.eventLog = [finalRole === "hunter" ? `Solo practice: You are the Hunter. Find the ${animalCount} AI animals!` : `Solo practice: You are an Animal. Survive the AI Hunter!`];
    logEvent("solo_start", { roomId: this.roomId(), role: finalRole, botCount: this.state.players.length - 1 });
    // Server-owned countdown before solo gameplay begins.
    this.state.phase = "COUNTDOWN";
    this.state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.state.timeRemaining = this.state.matchDuration;
    this.broadcastState();
    this.startCountdown();
  }
  updateBots(nowMs: number) {
    for (const p of this.state.players) { if (!p.isBot || !p.isAlive) continue; if (p.isHunter) this.updateBotHunter(p, nowMs); else this.updateBotAnimal(p, nowMs); }
  }
  updateBotAnimal(bot: PlayerState, nowMs: number) {
    const lastUpdate = bot.botLastUpdate ?? nowMs;
    const dt = Math.min((nowMs - lastUpdate) / 1000, 0.1);
    bot.botLastUpdate = nowMs;

    const tuning = DIFFICULTY_TUNING[this.state.soloDifficulty];
    const lastDecision = bot.botLastDecision ?? 0;
    if (nowMs - lastDecision > tuning.animalDecisionMs + Math.random() * tuning.animalDecisionJitterMs) {
      bot.botLastDecision = nowMs;
      const hunter = this.state.players.find((player) => player.isHunter && player.isAlive);
      const threatDistance = hunter ? Math.hypot(bot.x - hunter.x, bot.y - hunter.y) : Infinity;
      const evasive = !!hunter && threatDistance < (this.state.soloDifficulty === "hard" ? 820 : this.state.soloDifficulty === "normal" ? 620 : 420);
      const away = hunter ? Math.atan2(bot.y - hunter.y, bot.x - hunter.x) : 0;
      const angle = evasive ? away + (Math.random() - 0.5) * (this.state.soloDifficulty === "hard" ? 0.45 : 1.15) : Math.random() * Math.PI * 2;
      const speed = (205 + Math.random() * 55) * tuning.movement;
      bot.botVx = Math.cos(angle) * speed;
      bot.botVy = Math.sin(angle) * speed;
      const pauseChance = this.state.soloDifficulty === "easy" ? 0.22 : this.state.soloDifficulty === "hard" ? 0.025 : 0.09;
      if (!evasive && Math.random() < pauseChance) { bot.botVx = 0; bot.botVy = 0; }
    }
    const vx = bot.botVx ?? 0;
    const vy = bot.botVy ?? 0;
    bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + vx * dt));
    bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + vy * dt));
    if (bot.x <= 60 || bot.x >= WORLD_SIZE - 60) bot.botVx = -(bot.botVx ?? 0);
    if (bot.y <= 60 || bot.y >= WORLD_SIZE - 60) bot.botVy = -(bot.botVy ?? 0);
  }
  updateBotHunter(bot: PlayerState, nowMs: number) {
    const lastUpdate = bot.botLastUpdate ?? nowMs;
    const dt = Math.min((nowMs - lastUpdate) / 1000, 0.1);
    bot.botLastUpdate = nowMs;

    const targets = this.state.players.filter((p) => !p.isHunter && p.isAlive);
    if (targets.length === 0) return;
    let nearest = targets[0]; let nearestDist = Infinity;
    for (const t of targets) { const d = Math.hypot(t.x - bot.x, t.y - bot.y); if (d < nearestDist) { nearestDist = d; nearest = t; } }
    const lastDecision = bot.botLastDecision ?? 0;
    const tuning = DIFFICULTY_TUNING[this.state.soloDifficulty];
    if (nowMs - lastDecision > tuning.animalDecisionMs * 1.6 + Math.random() * tuning.animalDecisionJitterMs) {
      bot.botLastDecision = nowMs; bot.botPatrolling = Math.random() < tuning.patrolChance;
      if (bot.botPatrolling) {
        const angle = Math.random() * Math.PI * 2; const range = 300 + Math.random() * 500;
        bot.botPatrolX = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.cos(angle) * range));
        bot.botPatrolY = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.sin(angle) * range));
      }
    }
    const PATROL_SPEED = tuning.patrolSpeed; const CHASE_SPEED = tuning.chaseSpeed;
    let moveX: number, moveY: number, moveDist: number, speed: number;
    if (bot.botPatrolling) {
      const px = bot.botPatrolX ?? WORLD_SIZE / 2; const py = bot.botPatrolY ?? WORLD_SIZE / 2;
      moveX = px - bot.x; moveY = py - bot.y; moveDist = Math.hypot(moveX, moveY); speed = PATROL_SPEED;
    } else { moveX = nearest.x - bot.x; moveY = nearest.y - bot.y; moveDist = nearestDist; speed = CHASE_SPEED; }
    if (moveDist > 15) {
      bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + (moveX / moveDist) * speed * dt));
      bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + (moveY / moveDist) * speed * dt));
    }
    const lastShot = bot.botLastShot ?? 0;
    if (!bot.botPatrolling && nearestDist < tuning.shootRange && this.state.ammo > 0 && nowMs - lastShot > tuning.shotCooldownMs) {
      bot.botLastShot = nowMs;
      const leadSeconds = this.state.soloDifficulty === "hard" ? 0.28 : this.state.soloDifficulty === "normal" ? 0.12 : 0;
      const predictedX = nearest.x + (nearest.botVx ?? 0) * leadSeconds;
      const predictedY = nearest.y + (nearest.botVy ?? 0) * leadSeconds;
      const errorX = (Math.random() - 0.5) * tuning.shotSpread; const errorY = (Math.random() - 0.5) * tuning.shotSpread;
      this.handleBotShoot(predictedX + errorX, predictedY + errorY);
    }
  }
  handleBotShoot(targetX: number, targetY: number) {
    if (this.state.phase !== "PLAYING" || this.state.ammo <= 0 || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
    this.state.ammo -= 1;
    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) { if (p.isHunter || !p.isAlive) continue; const d = Math.hypot(targetX - p.x, targetY - p.y); if (d <= PLAYER_COLLISION_RADIUS) { hitPlayer = p; break; } }
    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife" && !hitPlayer.extraLifeUsed) {
        hitPlayer.animalType = randomAnimalExcept(hitPlayer.animalType, animalsForLevel(this.state.levelId));
        const spawn = safeMatchSpawn(this.state.players.indexOf(hitPlayer)); hitPlayer.x = spawn.x; hitPlayer.y = spawn.y;
        hitPlayer.perk = "none"; hitPlayer.extraLifeUsed = true;
        this.state.eventLog.unshift(`${hitPlayer.username}'s Extra Life saved them!`);
        this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true, extraLife: true, animalType: hitPlayer.animalType, x: hitPlayer.x, y: hitPlayer.y } });
      } else {
        hitPlayer.isAlive = false;
        this.state.eventLog.unshift(`${hitPlayer.username} was tagged by the AI Hunter!`);
        this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true } });
        this.checkWinCondition();
      }
    } else {
      this.state.eventLog.unshift("AI Hunter missed!");
      this.broadcast({ type: "HIT", payload: { targetId: null, targetX, targetY, hit: false } });
      if (this.state.ammo <= 0) this.endGame("animals", "AI Hunter ran out of ammo!");
    }
    this.state.eventLog = this.state.eventLog.slice(0, 10);
  }
}

// ── Open-world zone (Savannah Reserve) ───────────────────────────────────────
interface OWPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  animalType: AnimalType;
  selectedCosmetic: string | null;
  level: number;
  connId: string;
  lastSyncAt: number;
  lastCollectAt: Record<string, number>; // nodeId -> timestamp (recently collected)
}

interface OWState {
  players: OWPlayer[];
  collectibles: CollectibleNode[];
  dailySeed: string;
  lastResetDate: string;
  layoutVersion?: number;
  activeWorldEvent: WorldEvent | null;
}

export class OpenWorldZoneDurableObject implements DurableObject {
  state: OWState;
  broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private readonly sockets = new Set<WebSocket>();
  private readonly socketAttachments = new WeakMap<WebSocket, { userId: string; username: string; zoneId: ZoneId; connectionId: string }>();

  constructor(public ctx: DurableObjectState, public env: Env) {
    this.state = {
      players: [], collectibles: [], dailySeed: "", lastResetDate: "",
      layoutVersion: OW_LAYOUT_VERSION,
      activeWorldEvent: null,
    };
    const concurrencyGuard = (ctx as DurableObjectState & { blockConcurrencyWhile?: (callback: () => Promise<void>) => Promise<void> }).blockConcurrencyWhile;
    if (concurrencyGuard) {
      void concurrencyGuard.call(ctx, async () => {
        const stored = await ctx.storage.get<OWState>("ow");
        if (stored) this.state = { ...stored, players: [] };
      });
    }
  }

  private todaySeed(): string {
    return dailyQuestDateUTC();
  }

  private async ensureDaily(): Promise<void> {
    const today = this.todaySeed();
    if (this.state.dailySeed === today && this.state.collectibles.length > 0 && this.state.layoutVersion === OW_LAYOUT_VERSION) return;
    this.state.dailySeed = today;
    this.state.collectibles = generateCollectibles("savannahReserve", today);
    this.state.lastResetDate = today;
    this.state.layoutVersion = OW_LAYOUT_VERSION;
    await this.ctx.storage.put("ow", this.state);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || crypto.randomUUID();
    const username = url.searchParams.get("username") || "Anonymous";
    const zoneId = (url.searchParams.get("zoneId") as ZoneId) || "savannahReserve";
    const connectionId = crypto.randomUUID();
    await this.ensureDaily();

    const pair = new WebSocketPair();
    const client = pair[0]; const server = pair[1];
    server.accept();
    this.sockets.add(server);
    this.socketAttachments.set(server, { userId, username, zoneId, connectionId });
    server.addEventListener("message", (event) => this.webSocketMessage(server, event.data));
    server.addEventListener("close", (event) => this.webSocketClose(server, event.code, event.reason, event.wasClean));
    server.addEventListener("error", (event) => this.webSocketError(server, event));

    const profile = await this.getProfile(userId, username);
    const existing = this.state.players.find((p) => p.id === userId);
    if (existing) { existing.connId = connectionId; existing.lastSyncAt = Date.now(); }
    else {
      const returning = profile?.openWorld.lastZoneId === zoneId;
      this.state.players.push({
        id: userId,
        username,
        x: returning ? clampOW(profile.openWorld.lastX) : 3_000,
        y: returning ? clampOW(profile.openWorld.lastY) : 3_000,
        animalType: defaultAnimalForLevel("savannah"),
        selectedCosmetic: profile?.selectedCosmetic ?? null,
        level: profile?.level ?? 1,
        connId: connectionId,
        lastSyncAt: Date.now(),
        lastCollectAt: {},
      });
    }
    await this.ctx.storage.put("ow", this.state);
    this.startBroadcast();
    if (profile) this.sendProfileSync(userId, profile);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    const att = this.attachmentFor(ws);
    if (!att) return;
    let parsed: OpenWorldClientMessage;
    try { parsed = JSON.parse(message as string); } catch { return; }
    const player = this.state.players.find((p) => p.id === att.userId);
    if (!player) return;

    switch (parsed.type) {
      case "OPEN_WORLD_JOIN": {
        if (parsed.payload?.animalType) player.animalType = parsed.payload.animalType;
        // A reconnect may correct a small prediction gap, but cannot use JOIN
        // as an unrestricted teleport across the authoritative world.
        const requestedX = typeof parsed.payload?.x === "number" ? clampOW(parsed.payload.x) : player.x;
        const requestedY = typeof parsed.payload?.y === "number" ? clampOW(parsed.payload.y) : player.y;
        if (Math.hypot(requestedX - player.x, requestedY - player.y) <= 360) {
          player.x = requestedX;
          player.y = requestedY;
        }
        player.lastSyncAt = Date.now();
        this.broadcastState();
        void this.syncProfileMeta(player, { discoveredZones: ["savannahReserve"], lastZoneId: "savannahReserve", lastX: player.x, lastY: player.y });
        break;
      }
      case "OPEN_WORLD_SYNC": {
        const now = Date.now();
        const elapsedMs = Math.max(16, Math.min(250, now - player.lastSyncAt));
        const next = boundedOpenWorldPosition(
          { x: player.x, y: player.y },
          { x: parsed.payload?.x, y: parsed.payload?.y },
          elapsedMs,
        );
        player.x = next.x;
        player.y = next.y;
        player.lastSyncAt = now;
        if (parsed.payload?.animalType) player.animalType = parsed.payload.animalType;
        void this.ctx.storage.put("ow", this.state);
        break;
      }
      case "OPEN_WORLD_LEAVE": {
        void this.syncProfileMeta(player, { discoveredZones: ["savannahReserve"], lastZoneId: "savannahReserve", lastX: player.x, lastY: player.y });
        this.state.players = this.state.players.filter((p) => p.id !== att.userId);
        void this.ctx.storage.put("ow", this.state);
        this.broadcastState();
        break;
      }
      case "COLLECT_NODE": {
        const nodeId = parsed.payload?.nodeId;
        if (!nodeId) break;
        const node = this.state.collectibles.find((n) => n.id === nodeId);
        if (!node) { this.sendTo(ws, { type: "OPEN_WORLD_ERROR", payload: { code: "no_node", message: "Node not found" } }); break; }
        if (!collectibleInRange(player, node)) { this.sendTo(ws, { type: "OPEN_WORLD_ERROR", payload: { code: "out_of_range", message: "Move closer to collect this field find." } }); break; }
        if (!collectibleGrantable(node.respawnAt, Date.now())) break; // still respawning
        // Anti-double-collect: per-connection recent-collect guard.
        const last = player.lastCollectAt[nodeId] ?? 0;
        if (Date.now() - last < 1500) break;
        player.lastCollectAt[nodeId] = Date.now();
        node.respawnAt = Date.now() + COLLECTIBLE_RESPAWN_MS;
        void this.ctx.storage.put("ow", this.state);
        this.broadcast({ type: "COLLECTIBLE_COLLECTED", payload: { nodeId, byUserId: att.userId } });
        void this.grantCollectible(player, node);
        this.broadcastState();
        break;
      }
      case "QUEST_ACCEPT": {
        const qid = parsed.payload?.questId;
        if (!qid) break;
        void this.acceptQuest(player, qid);
        break;
      }
      case "QUEST_PROGRESS": {
        const qid = parsed.payload?.questId;
        const amount = parsed.payload?.amount ?? 1;
        if (!qid) break;
        void this.progressQuest(player, qid, amount);
        break;
      }
      case "QUEST_CLAIM": {
        const qid = parsed.payload?.questId;
        if (!qid) break;
        void this.claimQuest(player, qid);
        break;
      }
    }
  }

  webSocketClose(ws: WebSocket, _c: number, _r: string, _w: boolean): void {
    const att = this.attachmentFor(ws);
    if (!att) return;
    this.sockets.delete(ws);
    const player = this.state.players.find((p) => p.id === att.userId);
    if (player && player.connId === att.connectionId) {
      void this.syncProfileMeta(player, { discoveredZones: ["savannahReserve"], lastZoneId: "savannahReserve", lastX: player.x, lastY: player.y });
      this.state.players = this.state.players.filter((p) => p.id !== att.userId);
    }
    this.broadcastState();
    if (this.state.players.length === 0 && this.broadcastInterval) { clearInterval(this.broadcastInterval); this.broadcastInterval = null; }
  }
  webSocketError(ws: WebSocket, _e: unknown): void { this.webSocketClose(ws, 0, "", false); }

  // ── Profile bridge (always server-internal, signed with reward secret) ─────
  private async getProfile(userId: string, username: string): Promise<PlayerProfile | null> {
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      const res = await stub.fetch(`https://profile/?action=get&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`);
      return (await res.json()) as PlayerProfile;
    } catch { return null; }
  }

  private async owSync(userId: string, username: string, body: Record<string, unknown>): Promise<PlayerProfile | null> {
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      const res = await stub.fetch(`https://profile/?action=ow_sync&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-reward-secret": this.env.INTERNAL_REWARD_SECRET ?? "" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as PlayerProfile;
    } catch { return null; }
  }

  private async syncProfileMeta(player: OWPlayer, openWorld: Partial<PlayerProfile["openWorld"]>): Promise<void> {
    const prof = await this.owSync(player.id, player.username, { openWorld });
    if (prof) this.sendProfileSync(player.id, prof);
  }

  private async grantCollectible(player: OWPlayer, node: CollectibleNode): Promise<void> {
    const before = await this.getProfile(player.id, player.username);
    const questProgress: Record<string, QuestProgress> = {};
    if (before) {
      for (const def of QUEST_CATALOG) {
        const current = before.questProgress[def.id];
        if (def.objectiveType !== "collect" || current?.status !== "active") continue;
        const progress = Math.min(def.targetCount, current.progress + 1);
        questProgress[def.id] = { ...current, progress, status: progress >= def.targetCount ? "complete" : "active", completedAt: progress >= def.targetCount ? Date.now() : current.completedAt };
      }
    }
    const prof = await this.owSync(player.id, player.username, {
      stats: { collectiblesFound: 1 },
      reward: { coins: node.value, metadata: { source: "collectible", kind: node.kind, nodeId: node.id } },
      ...(Object.keys(questProgress).length ? { questProgress } : {}),
    });
    if (prof) {
      this.sendToPlayer(player.id, { type: "REWARD_GRANTED", payload: { coins: node.value, xp: 0, badges: 0, reason: `collect_${node.kind}` } });
      for (const quest of Object.values(questProgress)) this.sendToPlayer(player.id, { type: "QUEST_UPDATED", payload: quest });
      this.sendProfileSync(player.id, prof);
    }
  }

  private async acceptQuest(player: OWPlayer, qid: QuestId): Promise<void> {
    const def = questById(qid);
    if (!def) return;
    const prof = await this.getProfile(player.id, player.username);
    if (!prof) return;
    const existing = prof.questProgress[qid];
    if (existing && existing.status !== "available") return;
    const now = Date.now();
    const updated: QuestProgress = { questId: qid, status: "active", progress: 0, targetCount: def.targetCount };
    const body: Record<string, unknown> = { questProgress: { [qid]: updated } };
    // Reset daily quests if the UTC day changed.
    if (def.daily && prof.dailyQuestDate !== this.todaySeed()) {
      body.dailyQuestDate = this.todaySeed();
    }
    const next = await this.owSync(player.id, player.username, body);
    if (next) this.sendToPlayer(player.id, { type: "QUEST_UPDATED", payload: next.questProgress[qid] });
  }

  private async progressQuest(player: OWPlayer, qid: QuestId, amount: number): Promise<void> {
    const def = questById(qid);
    if (!def) return;
    const prof = await this.getProfile(player.id, player.username);
    if (!prof) return;
    const cur = prof.questProgress[qid];
    if (!cur || cur.status !== "active") return;
    const progress = Math.min(def.targetCount, cur.progress + amount);
    const status: QuestStatus = progress >= def.targetCount ? "complete" : "active";
    const updated: QuestProgress = { ...cur, progress, status, completedAt: status === "complete" ? Date.now() : cur.completedAt };
    const next = await this.owSync(player.id, player.username, { questProgress: { [qid]: updated } });
    if (next) this.sendToPlayer(player.id, { type: "QUEST_UPDATED", payload: next.questProgress[qid] });
  }

  private async claimQuest(player: OWPlayer, qid: QuestId): Promise<void> {
    const def = questById(qid);
    if (!def) return;
    const prof = await this.getProfile(player.id, player.username);
    if (!prof) return;
    const cur = prof.questProgress[qid];
    const res = applyQuestClaim(prof, def, cur);
    if (!res.changed) return; // not complete, or already claimed (idempotent)
    const next = await this.owSync(player.id, player.username, {
      questProgress: { [qid]: cur },
      stats: { questsCompleted: 1 },
      reward: { coins: def.reward.coins, xp: def.reward.xp, badges: def.reward.badges ?? 0, metadata: { source: "quest_reward", questId: qid } },
    });
    if (next) {
      this.sendToPlayer(player.id, { type: "REWARD_GRANTED", payload: { coins: def.reward.coins, xp: def.reward.xp, badges: def.reward.badges ?? 0, reason: `quest_${qid}` } });
      this.sendProfileSync(player.id, next);
    }
  }

  private sendProfileSync(userId: string, profile: PlayerProfile): void {
    this.sendToPlayer(userId, { type: "PROFILE_SYNC", payload: profile });
  }

  private sendToPlayer(userId: string, msg: OpenWorldServerMessage): void {
    for (const ws of this.allSockets()) {
      const att = this.attachmentFor(ws);
      if (att?.userId === userId) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }
    }
  }
  private sendTo(ws: WebSocket, msg: OpenWorldServerMessage): void { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }

  private startBroadcast(): void {
    if (this.broadcastInterval) return;
    // 12 Hz snapshot (open-world does not need 30 Hz).
    this.broadcastInterval = setInterval(() => this.broadcastState(), 1000 / 12);
  }

  private broadcastState(): void {
    const payload: OpenWorldZoneState = {
      zoneId: "savannahReserve",
      players: this.state.players.map((p) => ({
        id: p.id, username: p.username, x: p.x, y: p.y,
        animalType: p.animalType, selectedCosmetic: p.selectedCosmetic, level: p.level,
      })),
      collectibles: this.state.collectibles.filter((n) => !n.respawnAt || n.respawnAt <= Date.now()),
      quests: QUEST_CATALOG,
      activeWorldEvent: this.state.activeWorldEvent,
      serverTime: Date.now(),
    };
    const data = JSON.stringify({ type: "OPEN_WORLD_STATE", payload });
    for (const ws of this.allSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }

  private attachmentFor(ws: WebSocket): { userId: string; username: string; zoneId: ZoneId; connectionId: string } | null {
    const current = this.socketAttachments.get(ws);
    if (current) return current;
    try { return ws.deserializeAttachment() as { userId: string; username: string; zoneId: ZoneId; connectionId: string } | null; } catch { return null; }
  }

  private allSockets(): WebSocket[] {
    const combined = new Set<WebSocket>(this.sockets);
    try { for (const socket of this.ctx.getWebSockets()) combined.add(socket); } catch { /* legacy hibernatable sockets only */ }
    return [...combined];
  }
  private broadcast(msg: OpenWorldServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.allSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }
}

function clampOW(v: number): number {
  return Math.max(40, Math.min(OW_WORLD_SIZE - 40, v));
}

export function boundedOpenWorldPosition(
  current: { x: number; y: number },
  requested: { x?: number; y?: number },
  elapsedMs: number,
): { x: number; y: number } {
  const requestedX = typeof requested.x === "number" && Number.isFinite(requested.x) ? clampOW(requested.x) : current.x;
  const requestedY = typeof requested.y === "number" && Number.isFinite(requested.y) ? clampOW(requested.y) : current.y;
  const dx = requestedX - current.x;
  const dy = requestedY - current.y;
  const distance = Math.hypot(dx, dy);
  const allowed = 36 + 460 * Math.max(16, Math.min(250, elapsedMs)) / 1_000;
  if (distance <= allowed || distance === 0) return { x: requestedX, y: requestedY };
  const ratio = allowed / distance;
  return { x: clampOW(current.x + dx * ratio), y: clampOW(current.y + dy * ratio) };
}

// ── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
    }

    if (url.pathname === "/api/rooms" || url.pathname.startsWith("/api/rooms/")) {
      const id = env.ROOM_DIRECTORY.idFromName("global-room-directory");
      return env.ROOM_DIRECTORY.get(id).fetch(request);
    }

    if (url.pathname.startsWith("/api/soccer/")) {
      const match = url.pathname.match(/^\/api\/soccer\/([^/]+)\/websocket$/);
      const roomId = match ? decodeURIComponent(match[1]).trim().toUpperCase() : "";
      if (!roomId) return new Response(JSON.stringify({ error: "room_required" }), { status: 400, headers: JSON_HEADERS });
      const directoryId = env.ROOM_DIRECTORY.idFromName("global-room-directory");
      const directory = env.ROOM_DIRECTORY.get(directoryId);
      let authorized = false;
      try {
        const authorization = await directory.fetch("https://directory/authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId, accessToken: url.searchParams.get("roomAccess") || undefined, activity: "soccer" }),
        });
        const result = await authorization.json() as { authorized?: boolean; activity?: string };
        authorized = result.authorized === true && (result.activity === undefined || result.activity === null || result.activity === "soccer");
      } catch {
        return new Response(JSON.stringify({ error: "room_directory_unavailable" }), { status: 503, headers: JSON_HEADERS });
      }
      if (!authorized) return new Response(JSON.stringify({ error: "soccer_room_access_required" }), { status: 403, headers: JSON_HEADERS });
      const upstreamUrl = new URL(request.url);
      upstreamUrl.searchParams.set("room", roomId);
      const id = env.SOCCER_ROOM.idFromName(`soccer:${roomId}`);
      return env.SOCCER_ROOM.get(id).fetch(new Request(upstreamUrl.toString(), request));
    }

    if (url.pathname.startsWith("/api/profile")) {
      const userId = url.searchParams.get("userId");
      if (!userId) return new Response(JSON.stringify({ error: "missing_userId" }), { status: 400, headers: JSON_HEADERS });
      const id = env.PLAYER_PROFILE.idFromName(userId);
      const stub = env.PLAYER_PROFILE.get(id);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith("/open-world")) {
      const zoneId = (url.searchParams.get("zoneId") as ZoneId) || "savannahReserve";
      const id = env.OPEN_WORLD_ZONE.idFromName(`zone:${zoneId}`);
      const stub = env.OPEN_WORLD_ZONE.get(id);
      return stub.fetch(request);
    }

    // Default: realtime match room. A room id is REQUIRED — we no longer fall
    // back to a shared global "lobby". Clients must create/join explicitly.
    const roomId = url.searchParams.get("room");
    if (!roomId) {
      logEvent("protocol_rejection", { reason: "room_required" });
      return new Response(JSON.stringify({ error: "room_required", detail: "Connect with an explicit ?room=<ROOM_ID> parameter." }), { status: 400, headers: JSON_HEADERS });
    }
    const directoryId = env.ROOM_DIRECTORY.idFromName("global-room-directory");
    const directory = env.ROOM_DIRECTORY.get(directoryId);
    let authorized = false;
    let directoryMaxPlayers: number | null = null;
    try {
      const authorization = await directory.fetch("https://directory/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          accessToken: url.searchParams.get("roomAccess") || undefined,
          activity: "hunt",
        }),
      });
      const result = await authorization.json() as { authorized?: boolean; maxPlayers?: number };
      authorized = result.authorized === true;
      if (Number.isInteger(result.maxPlayers) && Number(result.maxPlayers) >= 2 && Number(result.maxPlayers) <= 12) {
        directoryMaxPlayers = Number(result.maxPlayers);
      }
    } catch (error) {
      logEvent("room_authorization_failed", { roomId, detail: error instanceof Error ? error.message : "unknown" });
      return new Response(JSON.stringify({ error: "room_directory_unavailable" }), { status: 503, headers: JSON_HEADERS });
    }
    if (!authorized) {
      logEvent("room_access_rejected", { roomId });
      return new Response(JSON.stringify({ error: "private_room_access_required" }), { status: 403, headers: JSON_HEADERS });
    }
    const id = env.GAME_ROOM.idFromName(roomId);
    const stub = env.GAME_ROOM.get(id);
    if (directoryMaxPlayers !== null) {
      const headers = new Headers(request.headers);
      headers.set("x-room-max-players", String(directoryMaxPlayers));
      return stub.fetch(new Request(request, { headers }));
    }
    return stub.fetch(request);
  },
};
