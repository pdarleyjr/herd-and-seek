import { describe, expect, it } from "vitest";
import { parseServerFrame } from "./NetworkAdapter";

const validState = {
  phase: "LOBBY", players: [], npcSeeds: [], hunterId: null, ammo: 0, maxAmmo: 0,
  timeRemaining: 120, matchDuration: 120, winner: null, eventLog: [], levelId: "forest",
};

describe("runtime protocol validation", () => {
  it("accepts a bounded valid state frame", () => {
    expect(parseServerFrame(JSON.stringify({ type: "SYNC_STATE", payload: validState }))).toMatchObject({ ok: true });
  });

  it.each([
    "not json",
    JSON.stringify({ type: "UNKNOWN", payload: {} }),
    JSON.stringify({ type: "SYNC_STATE", payload: { ...validState, players: "bad" } }),
    JSON.stringify({ type: "HIT", payload: { hit: true, targetX: Number.NaN, targetY: 10 } }),
  ])("rejects malformed or unsafe frames", (frame) => {
    expect(parseServerFrame(frame).ok).toBe(false);
  });

  it("bounds oversized frames", () => {
    expect(parseServerFrame("x".repeat(1_000_001))).toEqual({ ok: false, code: "frame_too_large" });
  });

  it("accepts a finite decoy spawn and rejects malformed coordinates", () => {
    expect(parseServerFrame(JSON.stringify({ type: "DECOY_SPAWN", payload: { x: 100, y: 120, animalType: "rabbit", ownerId: "a", expiresAt: 9_000 } })).ok).toBe(true);
    expect(parseServerFrame(JSON.stringify({ type: "DECOY_SPAWN", payload: { x: "100", y: 120, animalType: "rabbit", ownerId: "a" } })).ok).toBe(false);
  });
});
