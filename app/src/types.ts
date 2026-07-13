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
export type GamePhase = "LOBBY" | "COUNTDOWN" | "PLAYING" | "ENDED";

// ── Level system (shared shape — mirrored manually in worker/src/index.ts) ──
export type LevelId = "forest" | "deepDark" | "savannah";

export type LevelDefinition = {
  id: LevelId;
  displayName: string;
  subtitle: string;
  biome: "forest" | "ocean" | "savannah";
  description: string;
  hunterSkin: "hunter" | "scuba" | "ranger";
  mapTheme: "forest" | "ocean" | "savannah";
  allowedAnimals: AnimalType[];
};

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

export const LEVELS: Record<LevelId, LevelDefinition> = {
  forest: {
    id: "forest",
    displayName: "Forest",
    subtitle: "Hide in trees, grass, rocks, and shadows.",
    biome: "forest",
    description: "Classic Herd & Seek: blend into the forest herd and avoid the hunter.",
    hunterSkin: "hunter",
    mapTheme: "forest",
    allowedAnimals: FOREST_ANIMALS,
  },
  deepDark: {
    id: "deepDark",
    displayName: "The Deep Dark",
    subtitle: "Dive through seaweed, barrels, boats, and dark currents.",
    biome: "ocean",
    description: "An ocean level where sea creatures hide among kelp, barrels, boats, and currents.",
    hunterSkin: "scuba",
    mapTheme: "ocean",
    allowedAnimals: OCEAN_ANIMALS,
  },
  savannah: {
    id: "savannah",
    displayName: "Savannah at Dusk",
    subtitle: "Blend into tall grass, acacia shade, and long sunset shadows.",
    biome: "savannah",
    description: "A golden savannah at dusk: hide in tall grass, behind termite mounds and acacia trees while the ranger tracks the herd.",
    hunterSkin: "ranger",
    mapTheme: "savannah",
    allowedAnimals: SAVANNAH_ANIMALS,
  },
};

export const LEVEL_ORDER: LevelId[] = ["forest", "deepDark", "savannah"];

export function isValidLevelId(id: unknown): id is LevelId {
  return id === "forest" || id === "deepDark" || id === "savannah";
}

export function animalsForLevel(levelId: LevelId): AnimalType[] {
  return LEVELS[levelId].allowedAnimals;
}

export function isAnimalAllowed(animal: AnimalType, levelId: LevelId): boolean {
  return LEVELS[levelId].allowedAnimals.includes(animal);
}

export function defaultAnimalForLevel(levelId: LevelId): AnimalType {
  return LEVELS[levelId].allowedAnimals[0];
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
  extraLifeUsed?: boolean;
  isBot?: boolean; // true for AI-controlled solo practice opponents
  connectionStatus?: "connected" | "reconnecting";
  joinedAt?: number;
  lastSeenAt?: number;
  perkActiveUntil?: number;
  perkCooldownUntil?: number;
  perkConsumed?: boolean;
}

export interface ReadyPayload {
  isReady?: boolean;
}

export interface SyncPayload {
  x: number;
  y: number;
  sequence?: number;
  timestamp?: number;
}

export interface ShootPayload {
  targetX: number;
  targetY: number;
}

export interface SelectAnimalPayload {
  animalType: AnimalType;
}

export interface SelectPerkPayload {
  perk: PerkType;
}

export interface SelectLevelPayload {
  levelId: LevelId;
}

export interface SetDurationPayload {
  duration: number;
}

export interface DecoyPayload {
  readonly [key: string]: never;
}

export interface NpcSeed {
  id: number;
  x: number;
  y: number;
  animalType: AnimalType;
}

export interface SerializedState {
  phase: GamePhase;
  players: PlayerState[];
  npcSeeds: NpcSeed[];
  hunterId: string | null;
  ammo: number;
  maxAmmo: number;
  timeRemaining: number;
  matchDuration: number;
  winner: "hunter" | "animals" | null;
  eventLog: string[];
  levelId: LevelId;
  hostUserId?: string | null;
  maxPlayers?: number;
  countdownEndsAt?: number | null;
}

export interface StartSoloPayload {
  role?: "hunter" | "animal" | "random";
  botCount?: number;
  difficulty?: SoloDifficulty;
}

export type SoloDifficulty = "easy" | "normal" | "hard";

export interface AnimalDef {
  value: AnimalType;
  label: string;
  emoji: string;
  ocean?: boolean;
  savannah?: boolean;
  /** Procedural fallback base color used when no PNG sprite exists. */
  color?: string;
  description?: string;
}

export const ANIMAL_OPTIONS: AnimalDef[] = [
  // Forest
  { value: "rabbit", label: "Rabbit", emoji: "🐰", color: "#d9c9b0", description: "Small, quick, blends into the herd." },
  { value: "bear", label: "Bear", emoji: "🐻", color: "#6b4a2a", description: "Larger body; bold but tough to miss." },
  { value: "owl", label: "Owl", emoji: "🦉", color: "#8a7a5a", description: "Quiet roamer of the trees." },
  { value: "snake", label: "Snake", emoji: "🐍", color: "#3f8a3a", description: "Low silhouette; great in grass." },
  { value: "frog", label: "Frog", emoji: "🐸", color: "#4cae4c", description: "Tiny and quick near ponds." },
  { value: "duck", label: "Duck", emoji: "🦆", color: "#5a6b5a", description: "Waddles near water and reeds." },
  { value: "dog", label: "Dog", emoji: "🐶", color: "#b07a3a", description: "Sociable herd animal." },
  { value: "panda", label: "Panda", emoji: "🐼", color: "#e8e8e8", description: "Big and unmistakable — a bold disguise." },
  // Other forest legacy animals (still loadable in older builds; kept for asset parity)
  { value: "elephant", label: "Elephant", emoji: "🐘", color: "#b0b0b0" },
  { value: "penguin", label: "Penguin", emoji: "🐧", color: "#2a2a2a" },
  { value: "monkey", label: "Monkey", emoji: "🐵", color: "#7a5a3a" },
  { value: "giraffe", label: "Giraffe", emoji: "🦒", color: "#d8b040" },
  { value: "horse", label: "Horse", emoji: "🐴", color: "#8a5a2a" },
  { value: "pig", label: "Pig", emoji: "🐷", color: "#e090a0" },
  { value: "cow", label: "Cow", emoji: "🐮", color: "#d8d8d0" },
  { value: "parrot", label: "Parrot", emoji: "🦜", color: "#3aa0d0" },
  // Ocean (The Deep Dark) — no PNG assets; rendered procedurally.
  { value: "fish", label: "Fish", emoji: "🐟", ocean: true, color: "#ff8a3c", description: "Small, quick, blends with schools." },
  { value: "turtle", label: "Turtle", emoji: "🐢", ocean: true, color: "#3f9a4a", description: "Slower, tougher, blends near barrels." },
  { value: "crab", label: "Crab", emoji: "🦀", ocean: true, color: "#e04030", description: "Sideways scuttle; blends near rocks." },
  { value: "octopus", label: "Octopus", emoji: "🐙", ocean: true, color: "#7a3aa0", description: "High camouflage; blends near kelp." },
  { value: "jellyfish", label: "Jellyfish", emoji: "🪼", ocean: true, color: "#ff6fae", description: "Slow drift; blends in currents." },
  { value: "shark", label: "Shark", emoji: "🦈", ocean: true, color: "#5a7090", description: "Larger decoy — intimidating but obvious." },
  { value: "seahorse", label: "Seahorse", emoji: "🐡", ocean: true, color: "#f5d030", description: "Small and tricky among kelp." },
  { value: "stingray", label: "Stingray", emoji: "🌊", ocean: true, color: "#1f6a6a", description: "Flat, blends in dark water." },
  // Savannah (Savannah at Dusk) — no PNG assets; rendered procedurally.
  { value: "zebra", label: "Zebra", emoji: "🦓", savannah: true, color: "#e8e6df", description: "Striped herd animal — hides in the pack." },
  { value: "gazelle", label: "Gazelle", emoji: "🦌", savannah: true, color: "#c99a5b", description: "Fast and light on its feet." },
  { value: "wildebeest", label: "Wildebeest", emoji: "🐃", savannah: true, color: "#5c534a", description: "Bulky calf; blends in the great herd." },
  { value: "warthog", label: "Warthog", emoji: "🐗", savannah: true, color: "#7a5a3a", description: "Low and quick near termite mounds." },
  { value: "ostrich", label: "Ostrich", emoji: "🦤", savannah: true, color: "#3a3230", description: "Tall runner; sprints across open ground." },
  { value: "meerkat", label: "Meerkat", emoji: "🦫", savannah: true, color: "#b89a6a", description: "Tiny lookout; slips into the grass." },
  { value: "hyena", label: "Hyena Pup", emoji: "🐕", savannah: true, color: "#9a8560", description: "Spotted pup; blends near cover." },
  { value: "secretarybird", label: "Secretary Bird", emoji: "🦅", savannah: true, color: "#c8c2b4", description: "Long-legged strider of the grass." },
];

export const ANIMAL_DEFS: Record<AnimalType, AnimalDef> = ANIMAL_OPTIONS.reduce(
  (acc, a) => { acc[a.value] = a; return acc; },
  {} as Record<AnimalType, AnimalDef>
);

export const PERK_OPTIONS: { value: PerkType; label: string; description: string; emoji: string }[] = [
  { value: "none", label: "No Perk", description: "Standard movement, no special ability", emoji: "🚫" },
  {
    value: "sprint",
    label: "Sprinting Dash",
    description: "+50% speed burst for 1.5s. Reveals a dust cloud!",
    emoji: "💨",
  },
  {
    value: "camouflage",
    label: "Camouflage Freeze",
    description: "Freeze perfectly for 3s. No movement at all.",
    emoji: "🫥",
  },
  {
    value: "extraLife",
    label: "Extra Life",
    description: "Survive your first shot! Revives automatically once.",
    emoji: "❤️",
  },
  {
    value: "decoy",
    label: "Decoy Drop",
    description: "Spawn a fake animal copy at your position to confuse the hunter.",
    emoji: "🎭",
  },
  {
    value: "speedBoost",
    label: "Speed Boost",
    description: "Permanently +30% base movement speed. No downside!",
    emoji: "⚡",
  },
];

// ── Connection lifecycle (mirrors worker connection model) ───────────────────
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

export type MatchMode = "multiplayer" | "solo";

export interface MatchSession {
  roomId: string;
  mode: MatchMode;
  hostUserId: string;
  createdAt: number;
}

export const WORLD_SIZE = 2000;
export const PLAYER_COLLISION_RADIUS = 34;
export const PLAYER_RENDER_RADIUS = 48;
export const NPC_COLLISION_RADIUS = 32;
export const ANIMAL_SPEED = 3.2;
export const HUNTER_SPEED = 3.7;

export const ALL_ANIMAL_TYPES: AnimalType[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
  "fish", "turtle", "crab", "octopus",
  "jellyfish", "shark", "seahorse", "stingray",
  "zebra", "gazelle", "wildebeest", "warthog",
  "ostrich", "meerkat", "hyena", "secretarybird",
];

export interface SyncStateMessage {
  type: "SYNC_STATE";
  payload: SerializedState;
}

export interface MatchStartMessage {
  type: "MATCH_START";
  payload: SerializedState;
}

export interface HitPayload {
  targetId: string | null;
  targetX: number;
  targetY: number;
  hit: boolean;
  extraLife?: boolean;
  animalType?: AnimalType;
  x?: number;
  y?: number;
}

export interface HitMessage {
  type: "HIT";
  payload: HitPayload;
}

export interface GameOverPayload {
  winner: "hunter" | "animals";
  reason: string;
  state: SerializedState;
}

export interface GameOverMessage {
  type: "GAME_OVER";
  payload: GameOverPayload;
}

export interface AdminAuditEntry {
  ts: number;
  adminId: string;
  action: string;
  detail: string;
}

export interface AdminOkMessage {
  type: "ADMIN_OK";
  payload: { auditLog: AdminAuditEntry[]; state: SerializedState };
}

export interface AdminDeniedMessage {
  type: "ADMIN_DENIED";
  payload: Record<string, never>;
}

export interface AdminLogMessage {
  type: "ADMIN_LOG";
  payload: { auditLog: AdminAuditEntry[] };
}

export interface DecoySpawnPayload {
  x: number;
  y: number;
  animalType: AnimalType;
  ownerId: string;
  expiresAt?: number;
}

export interface DecoySpawnMessage {
  type: "DECOY_SPAWN";
  payload: DecoySpawnPayload;
}

export type ServerMessage =
  | SyncStateMessage
  | MatchStartMessage
  | HitMessage
  | GameOverMessage
  | DecoySpawnMessage
  | AdminOkMessage
  | AdminDeniedMessage
  | AdminLogMessage;

export type AdminCommand =
  | "reset_room"
  | "end_match"
  | "force_start"
  | "set_level"
  | "set_duration"
  | "kick"
  | "clear_bots";

export type ClientMessage =
  | { type: "READY"; payload?: ReadyPayload }
  | { type: "SYNC"; payload: SyncPayload }
  | { type: "SHOOT"; payload: ShootPayload }
  | { type: "SELECT_ANIMAL"; payload: SelectAnimalPayload }
  | { type: "SELECT_PERK"; payload: SelectPerkPayload }
  | { type: "RESTART" }
  | { type: "ACTIVATE_PERK"; payload: { perk: PerkType } }
  | { type: "SET_DURATION"; payload: SetDurationPayload }
  | { type: "START_SOLO"; payload: StartSoloPayload }
  | { type: "SELECT_LEVEL"; payload: SelectLevelPayload }
  | { type: "LEAVE_ROOM" }
  | { type: "CLOSE_ROOM" }
  | { type: "ADMIN_AUTH"; payload: { adminKey: string } }
  | {
      type: "ADMIN_CMD";
      payload: {
        command: AdminCommand;
        levelId?: LevelId;
        duration?: number;
        targetId?: string;
        botCount?: number;
      };
    };
