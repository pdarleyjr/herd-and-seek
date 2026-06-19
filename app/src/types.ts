export type AnimalType =
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake";

export type PerkType = "sprint" | "camouflage" | "none";
export type GamePhase = "LOBBY" | "PLAYING" | "ENDED";

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
  winner: "hunter" | "animals" | null;
  eventLog: string[];
}

export interface ServerMessage {
  type: "SYNC_STATE" | "MATCH_START" | "HIT" | "GAME_OVER";
  payload: any;
}

export interface ClientMessage {
  type: "READY" | "SYNC" | "SHOOT" | "SELECT_ANIMAL" | "SELECT_PERK" | "RESTART";
  payload?: any;
}

export const ANIMAL_OPTIONS: { value: AnimalType; label: string; emoji: string }[] = [
  { value: "elephant", label: "Elephant", emoji: "🐘" },
  { value: "penguin", label: "Penguin", emoji: "🐧" },
  { value: "monkey", label: "Monkey", emoji: "🐵" },
  { value: "giraffe", label: "Giraffe", emoji: "🦒" },
  { value: "bear", label: "Bear", emoji: "🐻" },
  { value: "dog", label: "Dog", emoji: "🐶" },
  { value: "frog", label: "Frog", emoji: "🐸" },
  { value: "horse", label: "Horse", emoji: "🐴" },
  { value: "pig", label: "Pig", emoji: "🐷" },
  { value: "rabbit", label: "Rabbit", emoji: "🐰" },
  { value: "cow", label: "Cow", emoji: "🐮" },
  { value: "duck", label: "Duck", emoji: "🦆" },
  { value: "panda", label: "Panda", emoji: "🐼" },
  { value: "parrot", label: "Parrot", emoji: "🦜" },
  { value: "owl", label: "Owl", emoji: "🦉" },
  { value: "snake", label: "Snake", emoji: "🐍" },
];

export const PERK_OPTIONS: { value: PerkType; label: string; description: string }[] = [
  { value: "none", label: "No Perk", description: "Standard movement" },
  {
    value: "sprint",
    label: "Sprinting Dash",
    description: "+50% speed for 1.5s, but reveals a dust cloud",
  },
  {
    value: "camouflage",
    label: "Camouflage Freeze",
    description: "Lock in place for 3s, mimicking a sleeping NPC",
  },
];

export const WORLD_SIZE = 2000;
export const PLAYER_RADIUS = 32;
export const NPC_RADIUS = 32;
export const ANIMAL_SPEED = 3;
export const HUNTER_SPEED = 3.5;

export const ALL_ANIMAL_TYPES: AnimalType[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
];
