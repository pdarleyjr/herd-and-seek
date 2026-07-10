// ─────────────────────────────────────────────────────────────────────────────
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
export type GamePhase = "LOBBY" | "PLAYING" | "ENDED";

// ── Level system (mirrors app/src/types.ts — keep both in sync) ─────────────
export type LevelId = "forest" | "deepDark" | "savannah";

export const FOREST_ANIMALS: AnimalType[] = [
  "rabbit", "bear", "owl", "snake",
  "frog", "duck", "dog", "panda",
];

export const OCEAN_ANIMALS: AnimalType[] = [
  "fish", "turtle", "crab", "octopus",
  "jellyfish", "shark", "seahorse", "stingray",
];

export const SAVANNAH_ANIMALS: AnimalType[] = [
  "zebra", "gazelle", "wildebeest", "warthog",
  "ostrich", "meerkat", "hyena", "secretarybird",
];

export const LEVEL_ANIMALS: Record<LevelId, AnimalType[]> = {
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
  winner: "hunter" | "animals" | null;
  eventLog: string[];
  isSoloMode: boolean;
  levelId: LevelId;
}

// ── Open-world shared types ──────────────────────────────────────────────────
export type GameMode = "match" | "openWorld";
export type ZoneId = "savannahReserve";
export type DistrictId =
  | "lodge" | "grasslands" | "wateringHole" | "ridgeTrail" | "acaciaGrove";

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
export const QUEST_CATALOG: QuestDefinition[] = [
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

export const OW_WORLD_SIZE = 3000;
export const COLLECTIBLE_RESPAWN_MS = 30_000;

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
  { id: "lodge", cx: 1500, cy: 1500, spread: 220 },
  { id: "grasslands", cx: 650, cy: 1500, spread: 700 },
  { id: "wateringHole", cx: 2300, cy: 2250, spread: 260 },
  { id: "ridgeTrail", cx: 1500, cy: 420, spread: 380 },
  { id: "acaciaGrove", cx: 2300, cy: 820, spread: 360 },
];

function generateCollectibles(zoneId: ZoneId, dailySeed: string): CollectibleNode[] {
  const rnd = seededPrng(`${zoneId}:${dailySeed}`);
  const kinds: CollectibleNode["kind"][] = ["coin", "token", "supply", "track"];
  const valueFor = (k: CollectibleNode["kind"]) =>
    k === "coin" ? 5 : k === "token" ? 10 : k === "supply" ? 15 : 20;
  const nodes: CollectibleNode[] = [];
  let n = 0;
  for (const d of DISTRICTS) {
    const count = d.id === "grasslands" ? 12 : d.id === "wateringHole" ? 6 : 7;
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const x = Math.max(80, Math.min(OW_WORLD_SIZE - 80, d.cx + (rnd() - 0.5) * d.spread * 2));
      const y = Math.max(80, Math.min(OW_WORLD_SIZE - 80, d.cy + (rnd() - 0.5) * d.spread * 2));
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
  type: "READY" | "SYNC" | "SHOOT" | "SELECT_ANIMAL" | "SELECT_PERK" | "RESTART" | "DECOY" | "SET_DURATION" | "START_SOLO" | "SELECT_LEVEL" | "ADMIN_AUTH" | "ADMIN_CMD";
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
  PLAYER_PROFILE: DurableObjectNamespace;
  OPEN_WORLD_ZONE: DurableObjectNamespace;
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
const WORLD_SIZE = 2000;
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
  rewardsGranted = false;
  hunterTagCount = 0;
  adminConns = new Set<string>();
  auditLog: AdminAuditEntry[] = [];

  constructor(public ctx: DurableObjectState, public env: Env) {
    this.state = {
      phase: "LOBBY", players: [], npcSeeds: [], hunterId: null, ammo: 0, maxAmmo: 0,
      timeRemaining: MATCH_DURATION_DEFAULT, matchDuration: MATCH_DURATION_DEFAULT,
      matchStartTime: 0, winner: null, eventLog: [], isSoloMode: false, levelId: "forest",
    };
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || crypto.randomUUID();
    const username = url.searchParams.get("username") || "Anonymous";
    const connectionId = crypto.randomUUID();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, connectionId });
    this.addPlayer(userId, username, connectionId);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null;
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
        player.isReady = parsed.payload?.isReady ?? !player.isReady;
        this.broadcastState();
        this.tryStartMatch();
        break;
      case "SELECT_ANIMAL":
        if (this.state.phase === "LOBBY") {
          const choice = parsed.payload?.animalType as AnimalType | undefined;
          if (choice && isAnimalAllowed(choice, this.state.levelId)) player.animalType = choice;
          this.broadcastState();
        }
        break;
      case "SELECT_LEVEL": {
        if (this.state.phase !== "LOBBY") break;
        const requested = parsed.payload?.levelId;
        if (!isValidLevelId(requested)) break;
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
          const { x, y } = parsed.payload || {};
          if (typeof x === "number" && typeof y === "number") {
            player.x = Math.max(0, Math.min(WORLD_SIZE, x));
            player.y = Math.max(0, Math.min(WORLD_SIZE, y));
          }
        }
        break;
      case "SHOOT":
        if (this.state.phase === "PLAYING" && player.isHunter) this.handleShoot(parsed.payload);
        break;
      case "RESTART":
        if (this.state.phase === "ENDED") { this.resetRoom(); this.broadcastState(); }
        break;
      case "DECOY":
        if (this.state.phase === "PLAYING" && player.isAlive && !player.isHunter && player.perk === "decoy") {
          this.broadcast({ type: "DECOY_SPAWN", payload: { x: player.x, y: player.y, animalType: player.animalType, ownerId: userId } });
        }
        break;
      case "START_SOLO":
        if (this.state.phase === "LOBBY" && !player.isBot) {
          let role: "hunter" | "animal" | "random";
          if (parsed.payload?.role === "hunter") role = "hunter";
          else if (parsed.payload?.role === "animal") role = "animal";
          else role = "random";
          const botCount = parsed.payload?.botCount ?? 4;
          this.startSoloMatch(userId, role, botCount);
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
    }
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null;
    if (!attachment) return;
    this.adminConns.delete(attachment.connectionId);
    this.removePlayer(attachment.userId, attachment.connectionId);
    if (this.state.players.length === 0) this.stopLoops();
  }
  webSocketError(ws: WebSocket, _error: unknown): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null;
    if (!attachment) return;
    this.removePlayer(attachment.userId, attachment.connectionId);
  }

  addPlayer(id: string, username: string, connectionId: string) {
    if (this.state.isSoloMode && this.state.phase === "PLAYING") {
      const anyHuman = this.state.players.some((p) => !p.isBot);
      if (!anyHuman) this.resetRoom();
    }
    const existing = this.state.players.find((p) => p.id === id);
    if (!existing) {
      const roster = animalsForLevel(this.state.levelId);
      this.state.players.push({
        id, username, x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50, y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        animalType: randomAnimal(roster), isHunter: false, isReady: false, isAlive: true, perk: "none", extraLifeUsed: false, connId: connectionId,
      });
    } else {
      existing.isAlive = true; existing.isReady = false; existing.connId = connectionId;
      if (!isAnimalAllowed(existing.animalType, this.state.levelId)) existing.animalType = defaultAnimalForLevel(this.state.levelId);
    }
    this.broadcastState();
  }
  removePlayer(id: string, closingConnId?: string) {
    const player = this.state.players.find((p) => p.id === id);
    if (player && closingConnId && player.connId && player.connId !== closingConnId) return;
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (this.state.isSoloMode) {
      const humansLeft = this.state.players.some((p) => !p.isBot);
      if (!humansLeft) { this.resetRoom(); this.broadcastState(); return; }
    }
    if (this.state.phase === "PLAYING") {
      if (this.state.hunterId === id) this.endGame("animals", "Hunter disconnected!");
      else if (this.state.players.length < 2) this.endGame("animals", "Not enough players to continue!");
      else this.checkWinCondition();
    }
    this.broadcastState();
  }

  tryStartMatch() {
    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.length < 2) return;
    if (!this.state.players.every((p) => p.isReady)) return;
    const players = this.state.players;
    const hunterIndex = Math.floor(Math.random() * players.length);
    const hunterId = players[hunterIndex].id;
    players.forEach((p, i) => {
      p.isHunter = i === hunterIndex; p.isAlive = true; p.isReady = false; p.extraLifeUsed = false;
      p.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50; p.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
      if (!p.isHunter && !isAnimalAllowed(p.animalType, this.state.levelId)) p.animalType = defaultAnimalForLevel(this.state.levelId);
    });
    this.state.hunterId = hunterId;
    const animalCount = players.length - 1;
    this.state.ammo = animalCount * 10; this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length), animalsForLevel(this.state.levelId));
    this.state.phase = "PLAYING"; this.state.timeRemaining = this.state.matchDuration; this.state.matchStartTime = Date.now();
    this.state.winner = null; this.rewardsGranted = false; this.hunterTagCount = 0;
    this.state.eventLog = [`Match started! ${animalCount} animal(s) hiding.`];
    this.startSyncLoop(); this.startCountdown();
    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
  }

  handleShoot(payload: any) {
    if (this.state.phase !== "PLAYING") return;
    const { targetX, targetY } = payload || {};
    if (typeof targetX !== "number" || typeof targetY !== "number") return;
    if (this.state.ammo <= 0) return;
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
      this.state.ammo -= 1;
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
    this.broadcast({ type: "GAME_OVER", payload: { winner, reason, state: this.serializeState() } });
    setTimeout(() => { this.resetRoom(); this.broadcastState(); }, 5000);
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
      if (this.state.isSoloMode) { coins = Math.floor(coins * 0.5); xp = Math.floor(xp * 0.5); badges = 0; }
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
          for (const sock of this.ctx.getWebSockets()) {
            const att = sock.deserializeAttachment() as { userId: string } | null;
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
    this.stopLoops();
    this.state.phase = "LOBBY"; this.state.hunterId = null; this.state.ammo = 0; this.state.maxAmmo = 0;
    this.state.timeRemaining = this.state.matchDuration; this.state.winner = null; this.state.npcSeeds = [];
    this.state.eventLog = []; this.state.isSoloMode = false;
    this.state.players = this.state.players.filter((p) => !p.isBot);
    this.state.players.forEach((p) => { p.isHunter = false; p.isReady = false; p.isAlive = true; p.perk = "none"; p.extraLifeUsed = false; });
  }
  serializeState() {
    return {
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id, username: p.username, x: p.x, y: p.y, animalType: p.animalType, isHunter: p.isHunter,
        isReady: p.isReady, isAlive: p.isAlive, perk: p.perk, extraLifeUsed: p.extraLifeUsed, isBot: p.isBot ?? false,
      })),
      npcSeeds: this.state.npcSeeds, hunterId: this.state.hunterId, ammo: this.state.ammo, maxAmmo: this.state.maxAmmo,
      timeRemaining: this.state.timeRemaining, matchDuration: this.state.matchDuration, winner: this.state.winner,
      eventLog: this.state.eventLog, levelId: this.state.levelId,
    };
  }
  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }
  broadcastState() { this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() }); }

  // ── Solo / Bot system ─────────────────────────────────────────────────────
  startSoloMatch(humanId: string, humanRole: "hunter" | "animal" | "random", botCount: number) {
    if (this.state.phase !== "LOBBY") return;
    const human = this.state.players.find((p) => p.id === humanId);
    if (!human) return;
    this.state.players = this.state.players.filter((p) => !p.isBot);
    const BOT_ANIMAL_TYPES: AnimalType[] = animalsForLevel(this.state.levelId);
    if (!isAnimalAllowed(human.animalType, this.state.levelId)) human.animalType = defaultAnimalForLevel(this.state.levelId);
    const finalRole = humanRole === "random" ? (Math.random() < 0.5 ? "hunter" : "animal") : humanRole;
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
    human.x = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150; human.y = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150;
    const animalCount = this.state.players.filter((p) => !p.isHunter).length;
    this.state.ammo = animalCount * 10; this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(this.state.players.length), animalsForLevel(this.state.levelId));
    this.state.phase = "PLAYING"; this.state.timeRemaining = this.state.matchDuration; this.state.matchStartTime = Date.now();
    this.state.winner = null; this.state.isSoloMode = true; this.rewardsGranted = false; this.hunterTagCount = 0;
    this.state.eventLog = [finalRole === "hunter" ? `Solo practice: You are the Hunter. Find the ${animalCount} AI animals!` : `Solo practice: You are an Animal. Survive the AI Hunter!`];
    this.startSyncLoop(); this.startCountdown();
    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
  }
  updateBots(nowMs: number) {
    for (const p of this.state.players) { if (!p.isBot || !p.isAlive) continue; if (p.isHunter) this.updateBotHunter(p, nowMs); else this.updateBotAnimal(p, nowMs); }
  }
  updateBotAnimal(bot: PlayerState, nowMs: number) {
    const lastDecision = bot.botLastDecision ?? 0;
    if (nowMs - lastDecision > 900 + Math.random() * 2300) {
      bot.botLastDecision = nowMs;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 0.6;
      bot.botVx = Math.cos(angle) * speed; bot.botVy = Math.sin(angle) * speed;
      if (Math.random() < 0.10) { bot.botVx = 0; bot.botVy = 0; }
    }
    const vx = bot.botVx ?? 0; const vy = bot.botVy ?? 0;
    bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + vx)); bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + vy));
    if (bot.x <= 60 || bot.x >= WORLD_SIZE - 60) bot.botVx = -(bot.botVx ?? 0);
    if (bot.y <= 60 || bot.y >= WORLD_SIZE - 60) bot.botVy = -(bot.botVy ?? 0);
  }
  updateBotHunter(bot: PlayerState, nowMs: number) {
    const targets = this.state.players.filter((p) => !p.isHunter && p.isAlive);
    if (targets.length === 0) return;
    let nearest = targets[0]; let nearestDist = Infinity;
    for (const t of targets) { const d = Math.hypot(t.x - bot.x, t.y - bot.y); if (d < nearestDist) { nearestDist = d; nearest = t; } }
    const lastDecision = bot.botLastDecision ?? 0;
    if (nowMs - lastDecision > 3000 + Math.random() * 2000) {
      bot.botLastDecision = nowMs; bot.botPatrolling = Math.random() < 0.55;
      if (bot.botPatrolling) {
        const angle = Math.random() * Math.PI * 2; const range = 300 + Math.random() * 500;
        bot.botPatrolX = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.cos(angle) * range));
        bot.botPatrolY = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.sin(angle) * range));
      }
    }
    const PATROL_SPEED = 1.8; const CHASE_SPEED = 2.4;
    let moveX: number, moveY: number, moveDist: number, speed: number;
    if (bot.botPatrolling) {
      const px = bot.botPatrolX ?? WORLD_SIZE / 2; const py = bot.botPatrolY ?? WORLD_SIZE / 2;
      moveX = px - bot.x; moveY = py - bot.y; moveDist = Math.hypot(moveX, moveY); speed = PATROL_SPEED;
    } else { moveX = nearest.x - bot.x; moveY = nearest.y - bot.y; moveDist = nearestDist; speed = CHASE_SPEED; }
    if (moveDist > 15) {
      bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + (moveX / moveDist) * speed));
      bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + (moveY / moveDist) * speed));
    }
    const SHOOT_RANGE = 260; const lastShot = bot.botLastShot ?? 0;
    if (!bot.botPatrolling && nearestDist < SHOOT_RANGE && nowMs - lastShot > 3000) {
      bot.botLastShot = nowMs;
      const errorX = (Math.random() - 0.5) * 160; const errorY = (Math.random() - 0.5) * 160;
      this.handleBotShoot(nearest.x + errorX, nearest.y + errorY);
    }
  }
  handleBotShoot(targetX: number, targetY: number) {
    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) { if (p.isHunter || !p.isAlive) continue; const d = Math.hypot(targetX - p.x, targetY - p.y); if (d <= PLAYER_COLLISION_RADIUS) { hitPlayer = p; break; } }
    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife" && !hitPlayer.extraLifeUsed) {
        hitPlayer.animalType = randomAnimalExcept(hitPlayer.animalType, animalsForLevel(this.state.levelId));
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50; hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
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
  lastCollectAt: Record<string, number>; // nodeId -> timestamp (recently collected)
}

interface OWState {
  players: OWPlayer[];
  collectibles: CollectibleNode[];
  dailySeed: string;
  lastResetDate: string;
  activeWorldEvent: WorldEvent | null;
}

export class OpenWorldZoneDurableObject implements DurableObject {
  state: OWState;
  broadcastInterval: ReturnType<typeof setInterval> | null = null;

  constructor(public ctx: DurableObjectState, public env: Env) {
    this.state = {
      players: [], collectibles: [], dailySeed: "", lastResetDate: "",
      activeWorldEvent: null,
    };
  }

  private todaySeed(): string {
    return dailyQuestDateUTC();
  }

  private async ensureDaily(): Promise<void> {
    const today = this.todaySeed();
    if (this.state.dailySeed === today && this.state.collectibles.length > 0) return;
    this.state.dailySeed = today;
    this.state.collectibles = generateCollectibles("savannahReserve", today);
    this.state.lastResetDate = today;
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
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, username, zoneId, connectionId });

    const existing = this.state.players.find((p) => p.id === userId);
    if (existing) { existing.connId = connectionId; }
    else {
      this.state.players.push({
        id: userId, username, x: 1500, y: 1500,
        animalType: defaultAnimalForLevel("savannah"), selectedCosmetic: null, level: 1,
        connId: connectionId, lastCollectAt: {},
      });
    }
    await this.ctx.storage.put("ow", this.state);
    this.startBroadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    const att = ws.deserializeAttachment() as { userId: string; username: string; zoneId: ZoneId; connectionId: string } | null;
    if (!att) return;
    let parsed: OpenWorldClientMessage;
    try { parsed = JSON.parse(message as string); } catch { return; }
    const player = this.state.players.find((p) => p.id === att.userId);
    if (!player) return;

    switch (parsed.type) {
      case "OPEN_WORLD_JOIN": {
        if (parsed.payload?.animalType) player.animalType = parsed.payload.animalType;
        if (typeof parsed.payload?.x === "number") player.x = parsed.payload.x;
        if (typeof parsed.payload?.y === "number") player.y = parsed.payload.y;
        this.broadcastState();
        void this.syncProfileMeta(player, { discoveredZones: ["savannahReserve"], lastZoneId: "savannahReserve", lastX: player.x, lastY: player.y });
        break;
      }
      case "OPEN_WORLD_SYNC": {
        if (typeof parsed.payload?.x === "number") player.x = clampOW(parsed.payload.x);
        if (typeof parsed.payload?.y === "number") player.y = clampOW(parsed.payload.y);
        if (parsed.payload?.animalType) player.animalType = parsed.payload.animalType;
        break;
      }
      case "OPEN_WORLD_LEAVE": {
        this.state.players = this.state.players.filter((p) => p.id !== att.userId);
        this.broadcastState();
        break;
      }
      case "COLLECT_NODE": {
        const nodeId = parsed.payload?.nodeId;
        if (!nodeId) break;
        const node = this.state.collectibles.find((n) => n.id === nodeId);
        if (!node) { this.sendTo(ws, { type: "OPEN_WORLD_ERROR", payload: { code: "no_node", message: "Node not found" } }); break; }
        if (!collectibleGrantable(node.respawnAt, Date.now())) break; // still respawning
        // Anti-double-collect: per-connection recent-collect guard.
        const last = player.lastCollectAt[nodeId] ?? 0;
        if (Date.now() - last < 1500) break;
        player.lastCollectAt[nodeId] = Date.now();
        node.respawnAt = Date.now() + COLLECTIBLE_RESPAWN_MS;
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
    const att = ws.deserializeAttachment() as { userId: string; connectionId: string } | null;
    if (!att) return;
    const player = this.state.players.find((p) => p.id === att.userId);
    if (player && player.connId === att.connectionId) {
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
    const prof = await this.owSync(player.id, player.username, {
      stats: { collectiblesFound: 1 },
      reward: { coins: node.value, metadata: { source: "collectible", kind: node.kind, nodeId: node.id } },
    });
    if (prof) {
      this.sendToPlayer(player.id, { type: "REWARD_GRANTED", payload: { coins: node.value, xp: 0, badges: 0, reason: `collect_${node.kind}` } });
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
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { userId: string } | null;
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
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }
  private broadcast(msg: OpenWorldServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(data); } catch { /* closed */ } }
  }
}

function clampOW(v: number): number {
  return Math.max(40, Math.min(OW_WORLD_SIZE - 40, v));
}

// ── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
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

    // Default: realtime match room.
    const roomId = url.searchParams.get("room") || "lobby";
    const id = env.GAME_ROOM.idFromName(roomId);
    const stub = env.GAME_ROOM.get(id);
    return stub.fetch(request);
  },
};
