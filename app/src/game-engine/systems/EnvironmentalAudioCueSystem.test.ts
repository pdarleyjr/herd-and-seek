import { describe, expect, it, vi } from "vitest";
import { EnvironmentalAudioCueSystem } from "./EnvironmentalAudioCueSystem";
import type { TerrainSample } from "./TerrainSurfaceSystem";

const GRASS: TerrainSample = { kind: "grass", medium: "land", depth: 0, speedMultiplier: 1, drag: 0 };
const WATER: TerrainSample = { kind: "deepWater", medium: "water", depth: 1, speedMultiplier: 0.58, drag: 0.42 };
const ROCK: TerrainSample = { kind: "rock", medium: "land", depth: 0, speedMultiplier: 0.94, drag: 0.05 };
const TRAIL: TerrainSample = { kind: "trail", medium: "land", depth: 0, speedMultiplier: 1.04, drag: 0 };

describe("EnvironmentalAudioCueSystem", () => {
  it("emits surface-specific footsteps and splash cues at locomotion cadence", () => {
    const emit = vi.fn();
    const cues = new EnvironmentalAudioCueSystem({ quality: "high", emit });

    expect(cues.update({ actorId: "player", role: "animal", x: 20, y: 20, speed: 240, surface: GRASS, nowMs: 0 })?.kind).toBe("footstep-grass");
    expect(cues.update({ actorId: "player", role: "animal", x: 30, y: 20, speed: 240, surface: GRASS, nowMs: 100 })).toBeNull();
    expect(cues.update({ actorId: "player", role: "animal", x: 60, y: 20, speed: 240, surface: WATER, nowMs: 500 })?.kind).toBe("water-splash");
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("identifies NPC movement and bounds tracked actors for low-power devices", () => {
    const cues = new EnvironmentalAudioCueSystem({ quality: "battery", emit: () => {} });
    const first = cues.update({ actorId: "npc-0", role: "npc", x: 0, y: 0, speed: 90, surface: GRASS, nowMs: 0 });
    for (let index = 1; index < 30; index += 1) {
      cues.update({ actorId: `npc-${index}`, role: "npc", x: index, y: index, speed: 90, surface: GRASS, nowMs: index });
    }

    expect(first?.kind).toBe("npc-rustle");
    expect(cues.trackedActorCount).toBeLessThanOrEqual(8);
  });

  it("covers hard-surface cues and runtime quality reconfiguration", () => {
    const emit = vi.fn();
    const cues = new EnvironmentalAudioCueSystem({ quality: "high", emit });

    expect(cues.update({ actorId: "hunter", role: "hunter", x: 0, y: 0, speed: 260, surface: ROCK, nowMs: 0 })?.kind).toBe("footstep-rock");
    expect(cues.update({ actorId: "animal", role: "animal", x: 0, y: 0, speed: 220, surface: TRAIL, nowMs: 0 })?.kind).toBe("footstep-dirt");
    expect(cues.update({ actorId: "idle", role: "animal", x: 0, y: 0, speed: 0, surface: GRASS, nowMs: 0 })).toBeNull();
    cues.configure("battery");
    cues.remove("hunter");
    cues.clear();
    expect(cues.trackedActorCount).toBe(0);
  });
});
