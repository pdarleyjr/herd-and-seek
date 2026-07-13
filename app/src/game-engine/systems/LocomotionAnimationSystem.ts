import type { TerrainSample } from "./TerrainSurfaceSystem";

export type LocomotionRole = "hunter" | "animal" | "npc";
export type LocomotionState = "idle" | "walk" | "run" | "wade" | "swim";

export interface LocomotionPoseInput {
  elapsedMs: number;
  velocityX: number;
  velocityY: number;
  maxSpeed: number;
  surface: TerrainSample;
  role: LocomotionRole;
  reducedMotion: boolean;
}

export interface LocomotionPose {
  state: LocomotionState;
  intensity: number;
  cadence: number;
  angle: number;
  bobPx: number;
  scaleX: number;
  scaleY: number;
  surfaceOffsetPx: number;
}

export interface LocomotionSpriteLike {
  angle: number;
  displayHeight: number;
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  setAngle(angle: number): unknown;
  setOrigin(x: number, y: number): unknown;
  setScale(x: number, y: number): unknown;
}

export interface LocomotionShadowLike {
  scaleX: number;
  scaleY: number;
  setScale(x: number, y: number): unknown;
}

export interface LocomotionTarget {
  sprite: LocomotionSpriteLike;
  shadow?: LocomotionShadowLike;
}

interface TrackedTarget {
  target: LocomotionTarget;
  baseAngle: number;
  baseOriginX: number;
  baseOriginY: number;
  baseScaleX: number;
  baseScaleY: number;
  shadowScaleX: number;
  shadowScaleY: number;
  phaseOffsetMs: number;
}

const ROLE_MOTION = {
  hunter: { cadence: 3, amplitude: 0.86 },
  animal: { cadence: 3.6, amplitude: 1.08 },
  npc: { cadence: 2.5, amplitude: 0.78 },
} satisfies Record<LocomotionRole, { cadence: number; amplitude: number }>;

export function calculateLocomotionPose(input: LocomotionPoseInput): LocomotionPose {
  const speed = Math.hypot(input.velocityX, input.velocityY);
  const intensity = clamp(speed / Math.max(input.maxSpeed, 1), 0, 1);
  const isMoving = intensity >= 0.025;
  const roleMotion = ROLE_MOTION[input.role];
  const mediumCadence = input.surface.medium === "water" ? 0.52 : input.surface.medium === "wading" ? 0.72 : 1;
  const cadence = roleMotion.cadence * mediumCadence;
  const state: LocomotionState = !isMoving
    ? "idle"
    : input.surface.medium === "water"
      ? "swim"
      : input.surface.medium === "wading"
        ? "wade"
        : intensity > 0.62
          ? "run"
          : "walk";

  if (input.reducedMotion) {
    return { state, intensity, cadence, angle: 0, bobPx: 0, scaleX: 1, scaleY: 1, surfaceOffsetPx: 0 };
  }

  const phase = input.elapsedMs / 1_000 * cadence * Math.PI * 2;
  if (!isMoving) {
    const breath = Math.sin(input.elapsedMs / 620 * Math.PI) * 0.006 * roleMotion.amplitude;
    return { state, intensity, cadence, angle: breath * 55, bobPx: breath * 80, scaleX: 1 + breath, scaleY: 1 - breath, surfaceOffsetPx: 0 };
  }

  const waterMotion = input.surface.medium === "water" ? 0.72 : input.surface.medium === "wading" ? 0.82 : 1;
  const stride = Math.sin(phase);
  const compression = Math.sin(phase * 2);
  const verticalDirection = clamp(input.velocityY / Math.max(speed, 1), -1, 1);
  const angle = (stride * 4.6 + verticalDirection * 1.8) * intensity * roleMotion.amplitude * waterMotion;
  const bobPx = stride * 5.4 * intensity * roleMotion.amplitude * waterMotion;
  const squash = compression * 0.055 * intensity * roleMotion.amplitude * waterMotion;
  const surfaceOffsetPx = input.surface.medium === "water" ? 7 : input.surface.medium === "wading" ? 2.5 : 0;
  return {
    state,
    intensity,
    cadence,
    angle,
    bobPx,
    scaleX: 1 + squash,
    scaleY: 1 - squash * 0.86,
    surfaceOffsetPx,
  };
}

export class LocomotionAnimationSystem {
  private readonly targets = new Map<string, TrackedTarget>();

  update(actorId: string, target: LocomotionTarget, input: LocomotionPoseInput): LocomotionPose {
    let tracked = this.targets.get(actorId);
    if (!tracked || tracked.target.sprite !== target.sprite) {
      if (tracked) this.restore(tracked);
      tracked = {
        target,
        baseAngle: target.sprite.angle,
        baseOriginX: target.sprite.originX,
        baseOriginY: target.sprite.originY,
        baseScaleX: target.sprite.scaleX,
        baseScaleY: target.sprite.scaleY,
        shadowScaleX: target.shadow?.scaleX ?? 1,
        shadowScaleY: target.shadow?.scaleY ?? 1,
        phaseOffsetMs: hashPhase(actorId),
      };
      this.targets.set(actorId, tracked);
    }

    const pose = calculateLocomotionPose({ ...input, elapsedMs: input.elapsedMs + tracked.phaseOffsetMs });
    const sprite = tracked.target.sprite;
    sprite.setAngle(tracked.baseAngle + pose.angle);
    sprite.setScale(tracked.baseScaleX * pose.scaleX, tracked.baseScaleY * pose.scaleY);
    const presentationOffset = pose.surfaceOffsetPx + pose.bobPx;
    sprite.setOrigin(tracked.baseOriginX, tracked.baseOriginY + presentationOffset / Math.max(sprite.displayHeight, 1));
    tracked.target.shadow?.setScale(
      tracked.shadowScaleX * (1 + pose.intensity * 0.12 - pose.bobPx * 0.005),
      tracked.shadowScaleY * (1 - pose.intensity * 0.05),
    );
    return pose;
  }

  forget(actorId: string): void {
    const tracked = this.targets.get(actorId);
    if (!tracked) return;
    this.restore(tracked);
    this.targets.delete(actorId);
  }

  destroy(): void {
    for (const tracked of this.targets.values()) this.restore(tracked);
    this.targets.clear();
  }

  private restore(tracked: TrackedTarget): void {
    if (!tracked.target.sprite) return;
    tracked.target.sprite.setAngle(tracked.baseAngle);
    tracked.target.sprite.setScale(tracked.baseScaleX, tracked.baseScaleY);
    tracked.target.sprite.setOrigin(tracked.baseOriginX, tracked.baseOriginY);
    tracked.target.shadow?.setScale(tracked.shadowScaleX, tracked.shadowScaleY);
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hashPhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return Math.abs(hash % 1_400);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
