export type AnimalType =
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake"
  // Ocean roster (The Deep Dark)
  | "fish" | "turtle" | "crab" | "octopus"
  | "jellyfish" | "shark" | "seahorse" | "stingray"
  // Savannah roster (Savannah at Dusk)
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
  // Per-connection ownership tag (humans). Identifies which live WebSocket
  // owns this player entry so stale close handlers don't evict a reconnect.
  connId?: string;
  // Bot / AI fields (undefined for human players)
  isBot?: boolean;
  botVx?: number;
  botVy?: number;
  botLastDecision?: number;
  botLastShot?: number;
  botPatrolling?: boolean;   // hunter: true = wandering, false = chasing
  botPatrolX?: number;      // hunter: current patrol waypoint
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

// ── Economy / persistence ───────────────────────────────────────────────────
interface Env {
  GAME_ROOM: DurableObjectNamespace;
  PLAYER_PROFILE: DurableObjectNamespace;
  ADMIN_KEY?: string;
}

interface AdminAuditEntry {
  ts: number;
  adminId: string;
  action: string;
  detail: string;
}

interface MatchStats {
  matches: number;
  wins: number;
  losses: number;
  tags: number;       // animals neutralized as hunter
  survivals: number;  // matches survived as animal
}

interface PlayerProfile {
  userId: string;
  username: string;
  xp: number;
  level: number;
  coins: number;      // soft currency
  badges: number;     // prestige currency
  ownedCosmetics: string[];
  selectedCosmetic: string | null;
  stats: MatchStats;
  settings: Record<string, unknown>;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

// Shop catalog — server-authoritative pricing (mirrored in app/src/economy.ts).
interface CosmeticDef {
  id: string;
  price: number;       // in coins
  currency: "coins" | "badges";
}
const SHOP_CATALOG: Record<string, CosmeticDef> = {
  trail_leaf: { id: "trail_leaf", price: 120, currency: "coins" },
  trail_bubbles: { id: "trail_bubbles", price: 120, currency: "coins" },
  trail_dust: { id: "trail_dust", price: 120, currency: "coins" },
  nameplate_bronze: { id: "nameplate_bronze", price: 200, currency: "coins" },
  nameplate_gold: { id: "nameplate_gold", price: 600, currency: "coins" },
  hat_safari: { id: "hat_safari", price: 350, currency: "coins" },
  crown_prestige: { id: "crown_prestige", price: 3, currency: "badges" },
};

function xpForLevel(level: number): number {
  // Rising curve: level N needs 100 * N^1.5 total-ish; simple incremental here.
  return Math.floor(100 * Math.pow(level, 1.4));
}

function recomputeLevel(profile: PlayerProfile): void {
  let level = 1;
  while (profile.xp >= xpForLevel(level + 1)) level++;
  profile.level = level;
}

function newProfile(userId: string, username: string): PlayerProfile {
  const now = Date.now();
  return {
    userId,
    username: username || "Anonymous",
    xp: 0,
    level: 1,
    coins: 50, // small welcome grant
    badges: 0,
    ownedCosmetics: [],
    selectedCosmetic: null,
    stats: { matches: 0, wins: 0, losses: 0, tags: 0, survivals: 0 },
    settings: {},
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  };
}

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

// Persistent per-user profile. Authoritative source of truth for balances,
// inventory, XP, and stats (Durable Object storage — strongly consistent).
export class PlayerProfileDurableObject implements DurableObject {
  constructor(public ctx: DurableObjectState, public env: Env) {}

  private async load(userId: string, username?: string): Promise<PlayerProfile> {
    let profile = (await this.ctx.storage.get<PlayerProfile>("profile")) ?? null;
    if (!profile) {
      profile = newProfile(userId, username ?? "Anonymous");
      await this.ctx.storage.put("profile", profile);
    } else if (username && username !== profile.username) {
      profile.username = username;
    }
    return profile;
  }

  private async save(profile: PlayerProfile): Promise<void> {
    profile.updatedAt = Date.now();
    recomputeLevel(profile);
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

    if (action === "reward" && request.method === "POST") {
      // Trusted server-to-server reward from a match room.
      const body = (await request.json().catch(() => ({}))) as {
        coins?: number; badges?: number; xp?: number;
        stat?: Partial<MatchStats>;
      };
      profile.coins += Math.max(0, Math.floor(body.coins ?? 0));
      profile.badges += Math.max(0, Math.floor(body.badges ?? 0));
      profile.xp += Math.max(0, Math.floor(body.xp ?? 0));
      if (body.stat) {
        profile.stats.matches += body.stat.matches ?? 0;
        profile.stats.wins += body.stat.wins ?? 0;
        profile.stats.losses += body.stat.losses ?? 0;
        profile.stats.tags += body.stat.tags ?? 0;
        profile.stats.survivals += body.stat.survivals ?? 0;
      }
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    if (action === "purchase" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { cosmeticId?: string };
      const item = body.cosmeticId ? SHOP_CATALOG[body.cosmeticId] : undefined;
      if (!item) {
        return new Response(JSON.stringify({ error: "unknown_item", profile }), { status: 400, headers: JSON_HEADERS });
      }
      if (profile.ownedCosmetics.includes(item.id)) {
        return new Response(JSON.stringify({ error: "already_owned", profile }), { status: 400, headers: JSON_HEADERS });
      }
      const balance = item.currency === "coins" ? profile.coins : profile.badges;
      if (balance < item.price) {
        return new Response(JSON.stringify({ error: "insufficient_funds", profile }), { status: 400, headers: JSON_HEADERS });
      }
      if (item.currency === "coins") profile.coins -= item.price;
      else profile.badges -= item.price;
      profile.ownedCosmetics.push(item.id);
      if (!profile.selectedCosmetic) profile.selectedCosmetic = item.id;
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    if (action === "select" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { cosmeticId?: string | null };
      const id = body.cosmeticId ?? null;
      if (id === null || profile.ownedCosmetics.includes(id)) {
        profile.selectedCosmetic = id;
        await this.save(profile);
      }
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    if (action === "admin-grant" && request.method === "POST") {
      // Admin-authenticated economy adjustment (verified by caller via ADMIN_KEY).
      const body = (await request.json().catch(() => ({}))) as {
        key?: string; coins?: number; badges?: number; xp?: number; makeAdmin?: boolean;
      };
      if (!this.env.ADMIN_KEY || body.key !== this.env.ADMIN_KEY) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403, headers: JSON_HEADERS });
      }
      profile.coins = Math.max(0, profile.coins + Math.floor(body.coins ?? 0));
      profile.badges = Math.max(0, profile.badges + Math.floor(body.badges ?? 0));
      profile.xp = Math.max(0, profile.xp + Math.floor(body.xp ?? 0));
      if (typeof body.makeAdmin === "boolean") profile.isAdmin = body.makeAdmin;
      await this.save(profile);
      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: JSON_HEADERS });
  }
}

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
  const available = pool.filter(a => a !== current);
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
  // Per-match reward bookkeeping.
  rewardsGranted = false;
  hunterTagCount = 0;
  // Connection ids that have authenticated as admin this session.
  adminConns = new Set<string>();
  // Rolling audit log (also persisted to storage for replay/dispute review).
  auditLog: AdminAuditEntry[] = [];

  constructor(public ctx: DurableObjectState, public env: Env) {
    this.state = {
      phase: "LOBBY",
      players: [],
      npcSeeds: [],
      hunterId: null,
      ammo: 0,
      maxAmmo: 0,
      timeRemaining: MATCH_DURATION_DEFAULT,
      matchDuration: MATCH_DURATION_DEFAULT,
      matchStartTime: 0,
      winner: null,
      eventLog: [],
      isSoloMode: false,
      levelId: "forest",
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
    // Unique per-connection tag so we can tell apart multiple sockets sharing
    // the same userId (e.g. tab reload). The player entry records which
    // connection "owns" it, preventing a stale close handler from removing a
    // player that a newer connection re-added (which left the new socket
    // alive but player-less — every subsequent message was then ignored).
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
    try {
      parsed = JSON.parse(message as string);
    } catch {
      return;
    }

    // Admin authentication is handled before the player-existence guard so a
    // reconnecting admin can always re-authenticate on their live socket.
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
          // Only allow morphs valid for the currently selected level.
          if (choice && isAnimalAllowed(choice, this.state.levelId)) {
            player.animalType = choice;
          }
          this.broadcastState();
        }
        break;

      case "SELECT_LEVEL": {
        if (this.state.phase !== "LOBBY") break;
        const requested = parsed.payload?.levelId;
        if (!isValidLevelId(requested)) break;
        if (requested === this.state.levelId) {
          this.broadcastState();
          break;
        }
        this.state.levelId = requested;
        const roster = animalsForLevel(this.state.levelId);
        // Force every (human) player onto a valid morph for this level.
        for (const p of this.state.players) {
          if (!p.isBot && !isAnimalAllowed(p.animalType, this.state.levelId)) {
            p.animalType = defaultAnimalForLevel(this.state.levelId);
          }
        }
        // Clear leftover bots — they belong to a previous level/match.
        this.state.players = this.state.players.filter((p) => !p.isBot);
        this.state.npcSeeds = [];
        this.broadcastState();
        break;
      }

      case "SELECT_PERK":
        if (this.state.phase === "LOBBY") {
          player.perk = parsed.payload?.perk ?? "none";
          this.broadcastState();
        }
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
        if (this.state.phase === "PLAYING" && player.isHunter) {
          this.handleShoot(parsed.payload);
        }
        break;

      case "RESTART":
        if (this.state.phase === "ENDED") {
          this.resetRoom();
          this.broadcastState();
        }
        break;

      case "DECOY":
        if (this.state.phase === "PLAYING" && player.isAlive && !player.isHunter && player.perk === "decoy") {
          this.broadcast({
            type: "DECOY_SPAWN",
            payload: { x: player.x, y: player.y, animalType: player.animalType, ownerId: userId },
          });
        }
        break;

      case "START_SOLO":
        if (this.state.phase === "LOBBY" && !player.isBot) {
          // If no role specified (or "random"), server randomly assigns hunter/animal
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

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null;
    if (!attachment) return;
    this.adminConns.delete(attachment.connectionId);
    // Only remove the player if THIS connection still owns it. A newer
    // reconnect (same userId) takes over ownership, so a delayed close of the
    // old socket must not strip the player out from under the live socket.
    this.removePlayer(attachment.userId, attachment.connectionId);

    if (this.state.players.length === 0) {
      this.stopLoops();
    }
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string; connectionId: string } | null;
    if (!attachment) return;
    this.removePlayer(attachment.userId, attachment.connectionId);
  }

  addPlayer(id: string, username: string, connectionId: string) {
    // Safety net: if a previous solo match is stuck in PLAYING with only bots
    // (human disconnected without the reset path running), reset to LOBBY so a
    // reconnecting human gets a clean room. Without this the DO stays wedged
    // in PLAYING indefinitely and START_SOLO is silently ignored.
    if (this.state.isSoloMode && this.state.phase === "PLAYING") {
      const anyHuman = this.state.players.some((p) => !p.isBot);
      if (!anyHuman) {
        this.resetRoom();
      }
    }

    const existing = this.state.players.find((p) => p.id === id);
    if (!existing) {
      const roster = animalsForLevel(this.state.levelId);
      this.state.players.push({
        id,
        username,
        x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        animalType: randomAnimal(roster),
        isHunter: false,
        isReady: false,
        isAlive: true,
        perk: "none",
        extraLifeUsed: false,
        connId: connectionId,
      });
    } else {
      existing.isAlive = true;
      existing.isReady = false;
      existing.connId = connectionId;
      // Correct any now-invalid morph (e.g. after a level change).
      if (!isAnimalAllowed(existing.animalType, this.state.levelId)) {
        existing.animalType = defaultAnimalForLevel(this.state.levelId);
      }
    }
    this.broadcastState();
  }

  removePlayer(id: string, closingConnId?: string) {
    // Ownership guard: if a newer connection for the same userId now owns the
    // player entry, ignore this stale close so the live socket keeps its player.
    const player = this.state.players.find((p) => p.id === id);
    if (player && closingConnId && player.connId && player.connId !== closingConnId) {
      return;
    }
    this.state.players = this.state.players.filter((p) => p.id !== id);

    // Solo mode: if no human players remain, the bot-only match has no
    // spectator and would run forever — reset the room immediately so the
    // Durable Object returns to a clean LOBBY for the next connection.
    if (this.state.isSoloMode) {
      const humansLeft = this.state.players.some((p) => !p.isBot);
      if (!humansLeft) {
        this.resetRoom();
        this.broadcastState();
        return;
      }
    }

    if (this.state.phase === "PLAYING") {
      if (this.state.hunterId === id) {
        this.endGame("animals", "Hunter disconnected!");
      } else if (this.state.players.length < 2) {
        this.endGame("animals", "Not enough players to continue!");
      } else {
        this.checkWinCondition();
      }
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
      p.isHunter = i === hunterIndex;
      p.isAlive = true;
      p.isReady = false;
      p.extraLifeUsed = false;
      p.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
      p.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
      // Ensure every animal player has a valid morph for this level.
      if (!p.isHunter && !isAnimalAllowed(p.animalType, this.state.levelId)) {
        p.animalType = defaultAnimalForLevel(this.state.levelId);
      }
    });

    this.state.hunterId = hunterId;
    const animalCount = players.length - 1;
    this.state.ammo = animalCount * 10;
    this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length), animalsForLevel(this.state.levelId));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = this.state.matchDuration;
    this.state.matchStartTime = Date.now();
    this.state.winner = null;
    this.rewardsGranted = false;
    this.hunterTagCount = 0;
    this.state.eventLog = [`Match started! ${animalCount} animal(s) hiding.`];

    this.startSyncLoop();
    this.startCountdown();

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
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= PLAYER_COLLISION_RADIUS) {
        hitPlayer = p;
        break;
      }
    }

    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife") {
        const previousAnimal = hitPlayer.animalType;
        hitPlayer.animalType = randomAnimalExcept(previousAnimal, animalsForLevel(this.state.levelId));
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.perk = "none";
        hitPlayer.extraLifeUsed = true;
        this.state.eventLog.unshift(`${hitPlayer.username}'s Extra Life activated! Respawned as ${hitPlayer.animalType}.`);
        this.state.eventLog = this.state.eventLog.slice(0, 8);
this.broadcast({
           type: "HIT",
           payload: { targetId: hitPlayer.id, targetX, targetY, hit: true, extraLife: true, animalType: hitPlayer.animalType, x: hitPlayer.x, y: hitPlayer.y },
         });
        return;
      }
      hitPlayer.isAlive = false;
      this.state.eventLog.unshift(`${hitPlayer.username} was neutralized!`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.hunterTagCount += 1;
      this.broadcast({
        type: "HIT",
        payload: { targetId: hitPlayer.id, targetX, targetY, hit: true },
      });
      this.checkWinCondition();
    } else {
      this.state.ammo -= 1;
      this.state.eventLog.unshift(`Hunter missed! ${this.state.ammo} ammo left.`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.broadcast({
        type: "HIT",
        payload: { targetId: null, targetX, targetY, hit: false },
      });
      if (this.state.ammo <= 0) {
        this.endGame("animals", "Hunter ran out of ammo!");
      }
    }
  }

  checkWinCondition() {
    const aliveAnimals = this.state.players.filter(
      (p) => !p.isHunter && p.isAlive
    );
    if (aliveAnimals.length === 0) {
      this.endGame("hunter", "All animals neutralized!");
    }
  }

endGame(winner: "hunter" | "animals", reason: string) {
    if (this.state.phase === "ENDED") return;
    this.state.phase = "ENDED";
    this.state.winner = winner;
    this.state.timeRemaining = 0;
    this.state.eventLog.unshift(`Game Over: ${reason}`);
    this.state.eventLog = this.state.eventLog.slice(0, 10);
    this.stopLoops();
    // Persist match rewards to player profiles (server-authoritative economy).
    this.grantMatchRewards(winner);
    this.broadcast({
      type: "GAME_OVER",
      payload: { winner, reason, state: this.serializeState() },
    });
    setTimeout(() => {
      this.resetRoom();
      this.broadcastState();
    }, 5000);
  }

  // Award coins/badges/XP to each human player based on their match outcome.
  // Coins come from participation, survival, accurate hunter play, and wins —
  // not kills alone — so the economy is not a pure PvP grind.
  grantMatchRewards(winner: "hunter" | "animals") {
    if (this.rewardsGranted) return;
    this.rewardsGranted = true;
    const humans = this.state.players.filter((p) => !p.isBot);
    for (const p of humans) {
      const isWinner =
        (winner === "hunter" && p.isHunter) || (winner === "animals" && !p.isHunter);
      let coins = 10; // participation
      let xp = 15;
      let badges = 0;
      const stat: Partial<MatchStats> = { matches: 1 };
      if (p.isHunter) {
        coins += this.hunterTagCount * 8; // accurate hunter play
        xp += this.hunterTagCount * 10;
        stat.tags = this.hunterTagCount;
      } else if (p.isAlive) {
        coins += 15; // survived
        xp += 20;
        stat.survivals = 1;
      }
      if (isWinner) {
        coins += 25;
        xp += 30;
        badges += 1; // prestige currency for a win
        stat.wins = 1;
      } else {
        stat.losses = 1;
      }
      // Solo/practice matches earn a reduced payout.
      if (this.state.isSoloMode) {
        coins = Math.floor(coins * 0.5);
        xp = Math.floor(xp * 0.5);
        badges = 0;
      }
      this.rewardProfile(p.id, p.username, { coins, xp, badges, stat });
    }
  }

  async rewardProfile(
    userId: string,
    username: string,
    body: { coins: number; xp: number; badges: number; stat: Partial<MatchStats> },
  ) {
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      const url = `https://profile/?action=reward&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`;
      await stub.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
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

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  async handleAdminAuth(ws: WebSocket, connectionId: string, userId: string, username: string, key?: string) {
    if (!this.env.ADMIN_KEY || key !== this.env.ADMIN_KEY) {
      this.sendTo(ws, { type: "ADMIN_DENIED", payload: {} });
      return;
    }
    this.adminConns.add(connectionId);
    await this.loadAudit();
    await this.pushAudit(userId, "ADMIN_LOGIN", `${username} authenticated`);
    // Also flag the persistent profile as admin (best-effort).
    try {
      const id = this.env.PLAYER_PROFILE.idFromName(userId);
      const stub = this.env.PLAYER_PROFILE.get(id);
      await stub.fetch(
        `https://profile/?action=admin-grant&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, makeAdmin: true }) },
      );
    } catch { /* best-effort */ }
    this.sendTo(ws, {
      type: "ADMIN_OK",
      payload: { auditLog: this.auditLog, state: this.serializeState() },
    });
  }

  async handleAdminCommand(
    ws: WebSocket,
    connectionId: string,
    userId: string,
    payload: { command?: string; levelId?: LevelId; duration?: number; targetId?: string; botCount?: number },
  ) {
    if (!this.adminConns.has(connectionId)) {
      this.sendTo(ws, { type: "ADMIN_DENIED", payload: {} });
      return;
    }
    const cmd = payload.command;
    switch (cmd) {
      case "reset_room": {
        this.resetRoom();
        await this.pushAudit(userId, "RESET_ROOM", "Room reset to lobby");
        this.broadcastState();
        break;
      }
      case "end_match": {
        if (this.state.phase === "PLAYING") {
          this.endGame("animals", "Match ended by admin");
          await this.pushAudit(userId, "END_MATCH", "Force-ended match");
        }
        break;
      }
      case "force_start": {
        if (this.state.phase === "LOBBY") {
          for (const p of this.state.players) if (!p.isBot) p.isReady = true;
          this.broadcastState();
          this.tryStartMatch();
          await this.pushAudit(userId, "FORCE_START", "Forced match start");
        }
        break;
      }
      case "set_level": {
        if (this.state.phase === "LOBBY" && isValidLevelId(payload.levelId)) {
          this.state.levelId = payload.levelId;
          for (const p of this.state.players) {
            if (!p.isBot && !isAnimalAllowed(p.animalType, this.state.levelId)) {
              p.animalType = defaultAnimalForLevel(this.state.levelId);
            }
          }
          this.state.players = this.state.players.filter((p) => !p.isBot);
          await this.pushAudit(userId, "SET_LEVEL", `Level -> ${payload.levelId}`);
          this.broadcastState();
        }
        break;
      }
      case "set_duration": {
        if (this.state.phase === "LOBBY" && typeof payload.duration === "number") {
          const clamped = Math.max(MATCH_DURATION_MIN, Math.min(MATCH_DURATION_MAX, Math.round(payload.duration)));
          this.state.matchDuration = clamped;
          this.state.timeRemaining = clamped;
          await this.pushAudit(userId, "SET_DURATION", `Duration -> ${clamped}s`);
          this.broadcastState();
        }
        break;
      }
      case "kick": {
        const targetId = payload.targetId;
        if (targetId) {
          for (const sock of this.ctx.getWebSockets()) {
            const att = sock.deserializeAttachment() as { userId: string } | null;
            if (att?.userId === targetId) {
              try { sock.close(1000, "Removed by admin"); } catch { /* ignore */ }
            }
          }
          this.state.players = this.state.players.filter((p) => p.id !== targetId);
          await this.pushAudit(userId, "KICK", `Removed player ${targetId}`);
          this.broadcastState();
        }
        break;
      }
      case "clear_bots": {
        this.state.players = this.state.players.filter((p) => !p.isBot);
        await this.pushAudit(userId, "CLEAR_BOTS", "Removed all bots");
        this.broadcastState();
        break;
      }
      default:
        break;
    }
    this.sendTo(ws, { type: "ADMIN_LOG", payload: { auditLog: this.auditLog } });
  }

  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.state.phase === "PLAYING") {
        const now = Date.now();
        // Update bots every sync tick so their movement matches NPC speed visually
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
      if (elapsed >= this.state.matchDuration) {
        this.state.timeRemaining = 0;
        this.endGame("animals", "Time expired! Animals survived!");
        return;
      }
      this.state.timeRemaining = this.state.matchDuration - Math.floor(elapsed);
    }, 250);
  }

  stopLoops() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  resetRoom() {
    this.stopLoops();
    this.state.phase = "LOBBY";
    this.state.hunterId = null;
    this.state.ammo = 0;
    this.state.maxAmmo = 0;
    this.state.timeRemaining = this.state.matchDuration;
    this.state.winner = null;
    this.state.npcSeeds = [];
    this.state.eventLog = [];
    this.state.isSoloMode = false;
    // Remove bot players; reset human players
    this.state.players = this.state.players.filter((p) => !p.isBot);
    this.state.players.forEach((p) => {
      p.isHunter = false;
      p.isReady = false;
      p.isAlive = true;
      p.perk = "none";
      p.extraLifeUsed = false;
    });
  }

  serializeState() {
    return {
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id,
        username: p.username,
        x: p.x,
        y: p.y,
        animalType: p.animalType,
        isHunter: p.isHunter,
        isReady: p.isReady,
        isAlive: p.isAlive,
        perk: p.perk,
        extraLifeUsed: p.extraLifeUsed,
        isBot: p.isBot ?? false,
      })),
      npcSeeds: this.state.npcSeeds,
      hunterId: this.state.hunterId,
      ammo: this.state.ammo,
      maxAmmo: this.state.maxAmmo,
      timeRemaining: this.state.timeRemaining,
      matchDuration: this.state.matchDuration,
      winner: this.state.winner,
      eventLog: this.state.eventLog,
      levelId: this.state.levelId,
    };
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    const wsList = this.ctx.getWebSockets();
    for (const ws of wsList) {
      try {
        ws.send(data);
      } catch {
        // connection may be closed
      }
    }
  }

  broadcastState() {
    this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
  }

  // ── Solo / Bot system ─────────────────────────────────────────────────────

  startSoloMatch(humanId: string, humanRole: "hunter" | "animal" | "random", botCount: number) {
    if (this.state.phase !== "LOBBY") return;
    const human = this.state.players.find((p) => p.id === humanId);
    if (!human) return;

    // Remove any leftover bots
    this.state.players = this.state.players.filter((p) => !p.isBot);

    // Bot morphs are drawn only from the selected level's roster.
    const BOT_ANIMAL_TYPES: AnimalType[] = animalsForLevel(this.state.levelId);
    // If the human's current morph is not valid for this level, fix it.
    if (!isAnimalAllowed(human.animalType, this.state.levelId)) {
      human.animalType = defaultAnimalForLevel(this.state.levelId);
    }

    // Determine final role: random = 50/50 chance hunter or animal
    const finalRole = humanRole === "random" 
      ? (Math.random() < 0.5 ? "hunter" : "animal")
      : humanRole;

    if (finalRole === "hunter") {
      human.isHunter = true;
      // Spawn bot animals (botCount bots, plus possible bot hunter among them)
      const animalBots = Math.max(2, botCount - 1);
      for (let i = 0; i < animalBots; i++) {
        this.state.players.push({
          id: `bot_animal_${i}_${Date.now()}`,
          username: `Animal ${i + 1}`,
          x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          animalType: BOT_ANIMAL_TYPES[i % BOT_ANIMAL_TYPES.length],
          isHunter: false,
          isReady: true,
          isAlive: true,
          perk: "none",
          extraLifeUsed: false,
          isBot: true,
          botVx: (Math.random() - 0.5) * 5,
          botVy: (Math.random() - 0.5) * 5,
          botLastDecision: 0,
          botLastShot: 0,
        });
      }
      this.state.hunterId = human.id;
    } else {
      human.isHunter = false;
      // Spawn 1 bot hunter
      const botId = `bot_hunter_${Date.now()}`;
      this.state.players.push({
        id: botId,
        username: "🤖 AI Hunter",
        x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
        y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
        animalType: defaultAnimalForLevel(this.state.levelId),
        isHunter: true,
        isReady: true,
        isAlive: true,
        perk: "none",
        extraLifeUsed: false,
        isBot: true,
        botVx: 0,
        botVy: 0,
        botLastDecision: 0,
        botLastShot: 0,
      });
      this.state.hunterId = botId;
      // Spawn bot animal teammates so the human can blend into the herd.
      // Without these, the human is the ONLY target and dies almost instantly.
      const animalBots = Math.max(2, botCount - 1);
      for (let i = 0; i < animalBots; i++) {
        this.state.players.push({
          id: `bot_animal_${i}_${Date.now()}`,
          username: `Animal ${i + 1}`,
          x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          animalType: BOT_ANIMAL_TYPES[i % BOT_ANIMAL_TYPES.length],
          isHunter: false,
          isReady: true,
          isAlive: true,
          perk: "none",
          extraLifeUsed: false,
          isBot: true,
          botVx: (Math.random() - 0.5) * 5,
          botVy: (Math.random() - 0.5) * 5,
          botLastDecision: 0,
          botLastShot: 0,
        });
      }
    }

    // Reset human player for the match
    human.isAlive = true;
    human.isReady = false;
    human.extraLifeUsed = false;
    human.x = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150;
    human.y = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150;

    const animalCount = this.state.players.filter((p) => !p.isHunter).length;
    this.state.ammo = animalCount * 10;
    this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(this.state.players.length), animalsForLevel(this.state.levelId));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = this.state.matchDuration;
    this.state.matchStartTime = Date.now();
    this.state.winner = null;
    this.state.isSoloMode = true;
    this.rewardsGranted = false;
    this.hunterTagCount = 0;
    this.state.eventLog = [
      finalRole === "hunter"
        ? `Solo practice: You are the Hunter. Find the ${animalCount} AI animals!`
        : `Solo practice: You are an Animal. Survive the AI Hunter!`,
    ];

    this.startSyncLoop();
    this.startCountdown();
    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
  }

  updateBots(nowMs: number) {
    for (const p of this.state.players) {
      if (!p.isBot || !p.isAlive) continue;
      if (p.isHunter) {
        this.updateBotHunter(p, nowMs);
      } else {
        this.updateBotAnimal(p, nowMs);
      }
    }
  }

  updateBotAnimal(bot: PlayerState, nowMs: number) {
    const lastDecision = bot.botLastDecision ?? 0;
    // Mirror NPC behaviour: change direction every 1.5–3.5 seconds, rarely idle
    if (nowMs - lastDecision > 900 + Math.random() * 2300) {
      bot.botLastDecision = nowMs;
      const angle = Math.random() * Math.PI * 2;
      // Match NPC client speed (3.2 units/tick at 30 Hz)
      const speed = 3.0 + Math.random() * 0.6;
      bot.botVx = Math.cos(angle) * speed;
      bot.botVy = Math.sin(angle) * speed;
      // Only 10% chance of idle — standing still makes them stand out
      if (Math.random() < 0.10) { bot.botVx = 0; bot.botVy = 0; }
    }
    const vx = bot.botVx ?? 0;
    const vy = bot.botVy ?? 0;
    bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + vx));
    bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + vy));
    if (bot.x <= 60 || bot.x >= WORLD_SIZE - 60) bot.botVx = -(bot.botVx ?? 0);
    if (bot.y <= 60 || bot.y >= WORLD_SIZE - 60) bot.botVy = -(bot.botVy ?? 0);
  }

  updateBotHunter(bot: PlayerState, nowMs: number) {
    // Chase ALL alive non-hunter animals (including bot teammates) so the
    // human animal can blend into the herd instead of being the sole target.
    const targets = this.state.players.filter((p) => !p.isHunter && p.isAlive);
    if (targets.length === 0) return;

    let nearest = targets[0];
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - bot.x, t.y - bot.y);
      if (d < nearestDist) { nearestDist = d; nearest = t; }
    }

    // ── Decision: switch between patrol and chase every 3–5 seconds ──────
    const lastDecision = bot.botLastDecision ?? 0;
    if (nowMs - lastDecision > 3000 + Math.random() * 2000) {
      bot.botLastDecision = nowMs;
      // Medium difficulty: 55% patrol / 45% chase
      bot.botPatrolling = Math.random() < 0.55;
      if (bot.botPatrolling) {
        // Wander toward a random point, biased toward center of map
        const angle = Math.random() * Math.PI * 2;
        const range = 300 + Math.random() * 500;
        bot.botPatrolX = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.cos(angle) * range));
        bot.botPatrolY = Math.max(80, Math.min(WORLD_SIZE - 80, WORLD_SIZE / 2 + Math.sin(angle) * range));
      }
    }

    // ── Movement ─────────────────────────────────────────────────────────
    const PATROL_SPEED = 1.8; // slow wander (56% of hunter speed)
    const CHASE_SPEED  = 2.4; // purposeful chase (75% of hunter speed)

    let moveX: number, moveY: number, moveDist: number, speed: number;
    if (bot.botPatrolling) {
      const px = bot.botPatrolX ?? WORLD_SIZE / 2;
      const py = bot.botPatrolY ?? WORLD_SIZE / 2;
      moveX = px - bot.x; moveY = py - bot.y;
      moveDist = Math.hypot(moveX, moveY);
      speed = PATROL_SPEED;
    } else {
      moveX = nearest.x - bot.x; moveY = nearest.y - bot.y;
      moveDist = nearestDist;
      speed = CHASE_SPEED;
    }

    if (moveDist > 15) {
      bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + (moveX / moveDist) * speed));
      bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + (moveY / moveDist) * speed));
    }

    // ── Shooting — only when chasing AND close ────────────────────────────
    // Medium difficulty: must be within 260 units, 3s cooldown, large error
    const SHOOT_RANGE = 260;
    const lastShot = bot.botLastShot ?? 0;
    if (!bot.botPatrolling && nearestDist < SHOOT_RANGE && nowMs - lastShot > 3000) {
      bot.botLastShot = nowMs;
      // ±80 units error each axis — misses ~50% of the time at medium range
      const errorX = (Math.random() - 0.5) * 160;
      const errorY = (Math.random() - 0.5) * 160;
      this.handleBotShoot(nearest.x + errorX, nearest.y + errorY);
    }
  }

  handleBotShoot(targetX: number, targetY: number) {
    // Standard collision radius — same as human hunter, no generous bonus.
    // Can hit any alive non-hunter animal (including bot teammates) so the
    // herd-blending mechanic works for solo animal players.
    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) {
      if (p.isHunter || !p.isAlive) continue;
      const dist = Math.hypot(targetX - p.x, targetY - p.y);
      if (dist <= PLAYER_COLLISION_RADIUS) { hitPlayer = p; break; }
    }

    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife" && !hitPlayer.extraLifeUsed) {
        hitPlayer.animalType = randomAnimalExcept(hitPlayer.animalType, animalsForLevel(this.state.levelId));
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.perk = "none";
        hitPlayer.extraLifeUsed = true;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── Player profile / economy HTTP API ────────────────────────────────────
    if (url.pathname.startsWith("/api/profile")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: JSON_HEADERS });
      }
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "missing_userId" }), { status: 400, headers: JSON_HEADERS });
      }
      const id = env.PLAYER_PROFILE.idFromName(userId);
      const stub = env.PLAYER_PROFILE.get(id);
      return stub.fetch(request);
    }

    // ── Realtime game room (WebSocket) ───────────────────────────────────────
    const roomId = url.searchParams.get("room") || "lobby";
    const id = env.GAME_ROOM.idFromName(roomId);
    const stub = env.GAME_ROOM.get(id);
    return stub.fetch(request);
  },
};





