import type {
  AnimalType,
  ClientMessage,
  ConnectionStatus,
  LevelId,
  PerkType,
  SerializedState,
} from "../types";

export type QualityTier = "high" | "balanced" | "battery";

export interface ReactToPhaserEvents {
  MATCH_STATE: { state: SerializedState | null };
  MATCH_START: { state: SerializedState };
  MATCH_END: { state: SerializedState };
  LOCAL_PROFILE: { userId: string; username: string };
  SELECTED_LEVEL: { levelId: LevelId };
  SELECTED_ANIMAL: { animalType: AnimalType };
  SELECTED_PERK: { perk: PerkType };
  QUALITY_CHANGED: { tier: QualityTier };
  AUDIO_CHANGED: { muted: boolean; volume: number };
  PAUSE_CHANGED: { paused: boolean };
  CONNECTION_CHANGED: { status: ConnectionStatus };
}

export interface PhaserToReactEvents {
  SCENE_READY: { key: "BootScene" | "PreloadScene" | "LobbyPreviewScene" | "MatchScene" | "OpenWorldScene" };
  LOCAL_MOVE: { x: number; y: number; sequence: number; timestamp: number };
  SHOOT: { targetX: number; targetY: number };
  PERK_ACTIVATE: { perk: PerkType };
  COLLECT: { nodeId: string };
  QUEST_INTERACT: { questId: string; action: "accept" | "claim" };
  GAMEPLAY_ERROR: { code: string; detail: string };
  FPS_UPDATE: { fps: number };
  ACTION_PROMPT: { id: string; label: string } | null;
  TUTORIAL_STEP: { id: string; message: string };
  PLAYER_FEEDBACK: { kind: "hit" | "miss" | "perk" | "reward" | "blocked"; message: string };
  DECOY_SPAWN: { x: number; y: number; animalType: AnimalType; ownerId: string; expiresAt?: number };
}

export type GameEvents = ReactToPhaserEvents & PhaserToReactEvents;

export interface GameRuntimeContext {
  userId: string;
  username: string;
  send: (message: ClientMessage) => void;
  localPosition: { current: { x: number; y: number } };
}

export interface Vector2Like {
  x: number;
  y: number;
}
