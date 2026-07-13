import type { QualityTier } from "../types";
import type { LocomotionRole } from "./LocomotionAnimationSystem";
import type { TerrainSample } from "./TerrainSurfaceSystem";

export type EnvironmentalAudioCueKind =
  | "footstep-grass"
  | "footstep-dirt"
  | "footstep-rock"
  | "water-splash"
  | "npc-rustle";

export interface EnvironmentalAudioCue {
  kind: EnvironmentalAudioCueKind;
  actorId: string;
  role: LocomotionRole;
  x: number;
  y: number;
  intensity: number;
  surface: TerrainSample["kind"];
}

export interface EnvironmentalAudioUpdate {
  actorId: string;
  role: LocomotionRole;
  x: number;
  y: number;
  speed: number;
  surface: TerrainSample;
  nowMs: number;
}

interface ActorCadence {
  emittedAt: number;
  x: number;
  y: number;
  touchedAt: number;
}

const MAX_TRACKED: Record<QualityTier, number> = { high: 32, balanced: 18, battery: 8 };
const QUALITY_CADENCE: Record<QualityTier, number> = { high: 1, balanced: 1.14, battery: 1.34 };

export class EnvironmentalAudioCueSystem {
  private quality: QualityTier;
  private readonly emit: (cue: EnvironmentalAudioCue) => void;
  private readonly actors = new Map<string, ActorCadence>();

  constructor(options: { quality: QualityTier; emit: (cue: EnvironmentalAudioCue) => void }) {
    this.quality = options.quality;
    this.emit = options.emit;
  }

  get trackedActorCount(): number { return this.actors.size; }

  configure(quality: QualityTier): void {
    this.quality = quality;
    this.trimActors();
  }

  update(update: EnvironmentalAudioUpdate): EnvironmentalAudioCue | null {
    if (update.speed < 18) return null;
    let previous = this.actors.get(update.actorId);
    if (!previous) {
      this.ensureCapacity();
      previous = { emittedAt: Number.NEGATIVE_INFINITY, x: update.x, y: update.y, touchedAt: update.nowMs };
      this.actors.set(update.actorId, previous);
    }
    previous.touchedAt = update.nowMs;

    const interval = cueIntervalMs(update.speed, update.surface, update.role) * QUALITY_CADENCE[this.quality];
    const travel = Math.hypot(update.x - previous.x, update.y - previous.y);
    const minTravel = update.surface.medium === "land" ? 7 : 10;
    if (update.nowMs - previous.emittedAt < interval || Number.isFinite(previous.emittedAt) && travel < minTravel) return null;

    previous.emittedAt = update.nowMs;
    previous.x = update.x;
    previous.y = update.y;
    const cue: EnvironmentalAudioCue = {
      kind: cueKind(update.surface, update.role),
      actorId: update.actorId,
      role: update.role,
      x: update.x,
      y: update.y,
      intensity: Math.max(0.16, Math.min(1, update.speed / (update.role === "npc" ? 180 : 320))),
      surface: update.surface.kind,
    };
    this.emit(cue);
    return cue;
  }

  remove(actorId: string): void { this.actors.delete(actorId); }
  clear(): void { this.actors.clear(); }

  private ensureCapacity(): void {
    if (this.actors.size < MAX_TRACKED[this.quality]) return;
    let oldestId: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [actorId, actor] of this.actors) {
      if (actor.touchedAt >= oldestTime) continue;
      oldestId = actorId;
      oldestTime = actor.touchedAt;
    }
    if (oldestId) this.actors.delete(oldestId);
  }

  private trimActors(): void {
    while (this.actors.size > MAX_TRACKED[this.quality]) this.ensureCapacity();
  }
}

function cueKind(surface: TerrainSample, role: LocomotionRole): EnvironmentalAudioCueKind {
  if (surface.medium !== "land") return "water-splash";
  if (role === "npc") return "npc-rustle";
  if (surface.kind === "rock") return "footstep-rock";
  if (surface.kind === "trail" || surface.kind === "sand") return "footstep-dirt";
  return "footstep-grass";
}

function cueIntervalMs(speed: number, surface: TerrainSample, role: LocomotionRole): number {
  const roleFactor = role === "hunter" ? 0.92 : role === "npc" ? 1.25 : 1;
  const surfaceFactor = surface.medium === "water" ? 1.45 : surface.medium === "wading" ? 1.2 : 1;
  return Math.max(210, 540 - Math.min(speed, 360) * 0.88) * roleFactor * surfaceFactor;
}
