import { describe, expect, it, vi } from "vitest";
import { RippleEmissionPolicy, rippleBudgetFor, WaterRippleSystem } from "./WaterRippleSystem";
import type { TerrainSample } from "./TerrainSurfaceSystem";

const LAND: TerrainSample = { kind: "grass", medium: "land", depth: 0, speedMultiplier: 1, drag: 0 };
const WATER: TerrainSample = { kind: "deepWater", medium: "water", depth: 1, speedMultiplier: 0.58, drag: 0.42 };

describe("WaterRippleSystem emission policy", () => {
  it("emits displacement only for moving actors in water and throttles bursts", () => {
    const policy = new RippleEmissionPolicy("high", false);

    expect(policy.shouldEmit({ actorId: "local", x: 100, y: 100, speed: 220, surface: WATER, nowMs: 0 })).toBe(true);
    expect(policy.shouldEmit({ actorId: "local", x: 102, y: 100, speed: 220, surface: WATER, nowMs: 60 })).toBe(false);
    expect(policy.shouldEmit({ actorId: "local", x: 122, y: 100, speed: 220, surface: WATER, nowMs: 240 })).toBe(true);
    expect(policy.shouldEmit({ actorId: "land", x: 100, y: 100, speed: 220, surface: LAND, nowMs: 0 })).toBe(false);
    expect(policy.shouldEmit({ actorId: "idle", x: 100, y: 100, speed: 0, surface: WATER, nowMs: 0 })).toBe(false);
  });

  it("reduces the pool and motion budget on battery and reduced-motion tiers", () => {
    const high = rippleBudgetFor("high", false);
    const battery = rippleBudgetFor("battery", false);
    const reduced = rippleBudgetFor("high", true);

    expect(high.maxActive).toBeGreaterThan(battery.maxActive);
    expect(high.minIntervalMs).toBeLessThan(battery.minIntervalMs);
    expect(reduced.motionScale).toBeLessThan(battery.motionScale);
    expect(reduced.maxActive).toBeLessThan(high.maxActive);
  });

  it("reuses pooled Phaser rings and publishes bounded displacement cues", () => {
    const tweens: Array<{ onComplete: () => void }> = [];
    const rings: Array<ReturnType<typeof createFakeRing>> = [];
    const scene = {
      add: { ellipse: () => { const ring = createFakeRing(); rings.push(ring); return ring; } },
      tweens: {
        add: vi.fn((config: { onComplete: () => void }) => { tweens.push(config); return config; }),
        killTweensOf: vi.fn(),
      },
    };
    const onDisplacement = vi.fn();
    const ripples = new WaterRippleSystem(scene as never, { quality: "high", reducedMotion: false, onDisplacement });

    expect(ripples.update({ actorId: "animal", x: 100, y: 100, speed: 300, surface: WATER, nowMs: 0 })).toBe(true);
    expect(rings).toHaveLength(1);
    expect(onDisplacement).toHaveBeenCalledWith(expect.objectContaining({ actorId: "animal", surface: "deepWater" }));
    tweens[0].onComplete();

    expect(ripples.update({ actorId: "animal", x: 140, y: 100, speed: 300, surface: WATER, nowMs: 300 })).toBe(true);
    expect(rings).toHaveLength(1);
    ripples.configure("battery", true);
    ripples.remove("animal");
    ripples.destroy();
    expect(rings[0].destroyed).toBe(true);
    expect(scene.tweens.killTweensOf).toHaveBeenCalled();
  });
});

function createFakeRing() {
  return {
    active: false,
    destroyed: false,
    setPosition() { return this; },
    setDisplaySize() { return this; },
    setStrokeStyle() { return this; },
    setFillStyle() { return this; },
    setScale() { return this; },
    setAlpha() { return this; },
    setDepth() { return this; },
    setVisible() { return this; },
    setActive(value: boolean) { this.active = value; return this; },
    destroy() { this.destroyed = true; },
  };
}
