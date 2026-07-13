import { describe, expect, it } from "vitest";
import { calculateLocomotionPose, LocomotionAnimationSystem } from "./LocomotionAnimationSystem";
import type { TerrainSample } from "./TerrainSurfaceSystem";

const LAND: TerrainSample = { kind: "grass", medium: "land", depth: 0, speedMultiplier: 1, drag: 0 };
const SHALLOWS: TerrainSample = { kind: "shallowWater", medium: "wading", depth: 0.45, speedMultiplier: 0.72, drag: 0.28 };
const WATER: TerrainSample = { kind: "deepWater", medium: "water", depth: 1, speedMultiplier: 0.58, drag: 0.42 };

describe("terrain-aware locomotion poses", () => {
  it("scales squash, tilt, and bob intensity with movement speed", () => {
    const slow = calculateLocomotionPose({ elapsedMs: 180, velocityX: 40, velocityY: 0, maxSpeed: 320, surface: LAND, role: "animal", reducedMotion: false });
    const fast = calculateLocomotionPose({ elapsedMs: 180, velocityX: 320, velocityY: 0, maxSpeed: 320, surface: LAND, role: "animal", reducedMotion: false });

    expect(fast.state).toBe("run");
    expect(fast.intensity).toBeGreaterThan(slow.intensity);
    expect(Math.abs(fast.angle)).toBeGreaterThan(Math.abs(slow.angle));
    expect(Math.abs(fast.bobPx)).toBeGreaterThan(Math.abs(slow.bobPx));
    expect(fast.scaleX).not.toBe(fast.scaleY);
  });

  it("uses distinct wading and swimming motion profiles", () => {
    const wading = calculateLocomotionPose({ elapsedMs: 240, velocityX: 210, velocityY: 30, maxSpeed: 320, surface: SHALLOWS, role: "hunter", reducedMotion: false });
    const swimming = calculateLocomotionPose({ elapsedMs: 240, velocityX: 210, velocityY: 30, maxSpeed: 320, surface: WATER, role: "animal", reducedMotion: false });

    expect(wading.state).toBe("wade");
    expect(swimming.state).toBe("swim");
    expect(swimming.cadence).toBeLessThan(wading.cadence);
    expect(swimming.surfaceOffsetPx).toBeGreaterThan(wading.surfaceOffsetPx);
  });

  it("removes nonessential movement for reduced-motion players", () => {
    const pose = calculateLocomotionPose({ elapsedMs: 180, velocityX: 320, velocityY: 0, maxSpeed: 320, surface: LAND, role: "npc", reducedMotion: true });

    expect(pose).toMatchObject({ angle: 0, bobPx: 0, scaleX: 1, scaleY: 1 });
  });

  it("keeps an organic idle breath and separates walking from running", () => {
    const idle = calculateLocomotionPose({ elapsedMs: 310, velocityX: 0, velocityY: 0, maxSpeed: 320, surface: LAND, role: "animal", reducedMotion: false });
    const walk = calculateLocomotionPose({ elapsedMs: 310, velocityX: 100, velocityY: 0, maxSpeed: 320, surface: LAND, role: "animal", reducedMotion: false });

    expect(idle.state).toBe("idle");
    expect(idle.scaleX).not.toBe(1);
    expect(walk.state).toBe("walk");
  });

  it("applies and restores presentation-only transforms", () => {
    const sprite = {
      angle: 2,
      displayHeight: 80,
      originX: 0.5,
      originY: 0.5,
      scaleX: 1.2,
      scaleY: 1.2,
      setAngle(value: number) { this.angle = value; return this; },
      setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
      setScale(x: number, y: number) { this.scaleX = x; this.scaleY = y; return this; },
    };
    const shadow = {
      scaleX: 1,
      scaleY: 1,
      setScale(x: number, y: number) { this.scaleX = x; this.scaleY = y; return this; },
    };
    const locomotion = new LocomotionAnimationSystem();

    locomotion.update("animal-1", { sprite, shadow }, { elapsedMs: 180, velocityX: 300, velocityY: 20, maxSpeed: 320, surface: LAND, role: "animal", reducedMotion: false });
    expect(sprite.angle).not.toBe(2);
    expect(sprite.originY).not.toBe(0.5);
    expect(shadow.scaleX).not.toBe(1);

    locomotion.forget("animal-1");
    expect(sprite).toMatchObject({ angle: 2, originX: 0.5, originY: 0.5, scaleX: 1.2, scaleY: 1.2 });
    expect(shadow).toMatchObject({ scaleX: 1, scaleY: 1 });

    locomotion.update("animal-2", { sprite }, { elapsedMs: 240, velocityX: 200, velocityY: 0, maxSpeed: 320, surface: SHALLOWS, role: "animal", reducedMotion: false });
    locomotion.destroy();
    expect(sprite).toMatchObject({ angle: 2, originY: 0.5, scaleX: 1.2, scaleY: 1.2 });
  });
});
