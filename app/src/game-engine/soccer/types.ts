export type SoccerTeamId = "coral" | "teal";
export type SoccerRole = "keeper" | "midfielder" | "striker";
export type SoccerPhase = "kickoff" | "playing" | "goal" | "ended";

export interface SoccerVector {
  x: number;
  y: number;
}

export interface SoccerBallSnapshot extends SoccerVector {
  vx: number;
  vy: number;
  spin: number;
}

export interface SoccerPlayerSnapshot extends SoccerVector {
  id: string;
  username: string;
  team: SoccerTeamId;
  role: SoccerRole;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  isAi: boolean;
  energy: number;
  kickCooldownMs: number;
}

export interface SoccerMatchSnapshot {
  matchId: string;
  revision: number;
  phase: SoccerPhase;
  coralScore: number;
  tealScore: number;
  remainingMs: number;
  phaseRemainingMs: number;
  kickoffTeam: SoccerTeamId;
  lastScorerId?: string;
  lastTouchPlayerId?: string;
  ball: SoccerBallSnapshot;
  players: SoccerPlayerSnapshot[];
}

export type SoccerCommand =
  | { type: "MOVE"; payload: SoccerVector & { sequence: number; sprint: boolean } }
  | { type: "KICK"; payload: { target: SoccerVector; power: number; sequence: number } }
  | { type: "SELECT_TEAM"; payload: { team: SoccerTeamId } }
  | { type: "RESTART"; payload?: never };

export type SoccerSnapshotListener = (snapshot: SoccerMatchSnapshot) => void;

/**
 * Transport-neutral contract consumed by SoccerScene. A server adapter should
 * validate incoming snapshots, retain only the newest revision, and map these
 * commands to its authoritative wire protocol. `advance` is optional and is
 * used only by the bundled deterministic solo adapter.
 */
export interface SoccerBridge {
  readonly localPlayerId: string;
  getSnapshot(): SoccerMatchSnapshot;
  subscribe(listener: SoccerSnapshotListener): () => void;
  send(command: SoccerCommand): void;
  advance?(deltaMs: number): void;
  destroy?(): void;
}

export interface LocalSoccerMatchOptions {
  localPlayerId: string;
  localPlayerName: string;
  selectedTeam: SoccerTeamId;
  teamSize: 3 | 5;
  matchId?: string;
}

export interface SoccerAiIntent {
  move: SoccerVector;
  kickTarget?: SoccerVector;
  kickPower?: number;
  sprint: boolean;
}
