import type Phaser from "phaser";
import type { QualityTier } from "../types";
import type { TerrainSample } from "./TerrainSurfaceSystem";

export interface RippleBudget {
  maxActive: number;
  minIntervalMs: number;
  minTravelPx: number;
  motionScale: number;
  durationMs: number;
}

export interface RippleUpdate {
  actorId: string;
  x: number;
  y: number;
  speed: number;
  surface: TerrainSample;
  nowMs: number;
}

export interface SurfaceDisplacementCue {
  actorId: string;
  x: number;
  y: number;
  intensity: number;
  surface: TerrainSample["kind"];
}

interface EmissionState {
  x: number;
  y: number;
  emittedAt: number;
}

export function rippleBudgetFor(quality: QualityTier, reducedMotion: boolean): RippleBudget {
  if (reducedMotion) return { maxActive: 3, minIntervalMs: 360, minTravelPx: 26, motionScale: 0.15, durationMs: 900 };
  if (quality === "high") return { maxActive: 18, minIntervalMs: 110, minTravelPx: 12, motionScale: 1, durationMs: 620 };
  if (quality === "balanced") return { maxActive: 10, minIntervalMs: 170, minTravelPx: 16, motionScale: 0.72, durationMs: 720 };
  return { maxActive: 5, minIntervalMs: 280, minTravelPx: 22, motionScale: 0.45, durationMs: 850 };
}

export class RippleEmissionPolicy {
  private readonly actors = new Map<string, EmissionState>();
  private budget: RippleBudget;

  constructor(quality: QualityTier, reducedMotion: boolean) {
    this.budget = rippleBudgetFor(quality, reducedMotion);
  }

  configure(quality: QualityTier, reducedMotion: boolean): void {
    this.budget = rippleBudgetFor(quality, reducedMotion);
  }

  shouldEmit(update: RippleUpdate): boolean {
    if (update.surface.medium === "land" || update.speed < 24) return false;
    const previous = this.actors.get(update.actorId);
    if (previous) {
      if (update.nowMs - previous.emittedAt < this.budget.minIntervalMs) return false;
      if (Math.hypot(update.x - previous.x, update.y - previous.y) < this.budget.minTravelPx) return false;
    }
    this.actors.set(update.actorId, { x: update.x, y: update.y, emittedAt: update.nowMs });
    return true;
  }

  remove(actorId: string): void { this.actors.delete(actorId); }
  clear(): void { this.actors.clear(); }
}

export class WaterRippleSystem {
  private readonly scene: Phaser.Scene;
  private readonly onDisplacement?: (cue: SurfaceDisplacementCue) => void;
  private readonly policy: RippleEmissionPolicy;
  private reducedMotion: boolean;
  private budget: RippleBudget;
  private readonly available: Phaser.GameObjects.Ellipse[] = [];
  private readonly active = new Set<Phaser.GameObjects.Ellipse>();
  private allocated = 0;

  constructor(scene: Phaser.Scene, options: {
    quality: QualityTier;
    reducedMotion: boolean;
    onDisplacement?: (cue: SurfaceDisplacementCue) => void;
  }) {
    this.scene = scene;
    this.reducedMotion = options.reducedMotion;
    this.onDisplacement = options.onDisplacement;
    this.policy = new RippleEmissionPolicy(options.quality, options.reducedMotion);
    this.budget = rippleBudgetFor(options.quality, options.reducedMotion);
  }

  configure(quality: QualityTier, reducedMotion = this.reducedMotion): void {
    this.reducedMotion = reducedMotion;
    this.budget = rippleBudgetFor(quality, reducedMotion);
    this.policy.configure(quality, reducedMotion);
  }

  update(update: RippleUpdate): boolean {
    if (!this.policy.shouldEmit(update) || this.active.size >= this.budget.maxActive) return false;
    const ripple = this.acquire();
    if (!ripple) return false;

    const intensity = Math.max(0.2, Math.min(1, update.speed / 320));
    const deep = update.surface.medium === "water";
    ripple
      .setPosition(update.x, update.y + (deep ? 14 : 22))
      .setDisplaySize(deep ? 38 : 30, deep ? 15 : 12)
      .setStrokeStyle(deep ? 3 : 2, deep ? 0xa9f3ef : 0xd9fbef, 0.72)
      .setFillStyle(0x78d8d2, deep ? 0.05 : 0.08)
      .setScale(0.65, 0.65)
      .setAlpha(0.78)
      .setDepth(update.y - 1)
      .setVisible(true)
      .setActive(true);
    const expansion = 1 + (1.15 + intensity * 0.75) * this.budget.motionScale;
    this.scene.tweens.add({
      targets: ripple,
      scaleX: expansion,
      scaleY: 0.82 + expansion * 0.35,
      alpha: 0,
      duration: this.budget.durationMs,
      ease: "Sine.easeOut",
      onComplete: () => this.release(ripple),
    });
    this.onDisplacement?.({ actorId: update.actorId, x: update.x, y: update.y, intensity, surface: update.surface.kind });
    return true;
  }

  remove(actorId: string): void { this.policy.remove(actorId); }

  destroy(): void {
    this.policy.clear();
    for (const ripple of [...this.active, ...this.available]) {
      this.scene.tweens.killTweensOf(ripple);
      ripple.destroy();
    }
    this.active.clear();
    this.available.length = 0;
    this.allocated = 0;
  }

  private acquire(): Phaser.GameObjects.Ellipse | null {
    const reused = this.available.pop();
    if (reused) { this.active.add(reused); return reused; }
    if (this.allocated >= this.budget.maxActive) return null;
    const ripple = this.scene.add.ellipse(0, 0, 32, 13, 0x78d8d2, 0).setVisible(false).setActive(false);
    this.allocated += 1;
    this.active.add(ripple);
    return ripple;
  }

  private release(ripple: Phaser.GameObjects.Ellipse): void {
    if (!this.active.delete(ripple) || !ripple.active) return;
    ripple.setVisible(false).setActive(false).setAlpha(0).setScale(1);
    this.available.push(ripple);
  }
}
