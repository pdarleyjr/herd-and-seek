import { describe, expect, it } from "vitest";
import { createPerkRuntime, getPerkSpec, tryActivatePerk } from "./PerkSystem";

describe("perk specification", () => {
  it("defines every selectable perk", () => {
    for (const perk of ["none", "sprint", "camouflage", "extraLife", "decoy", "speedBoost"] as const) {
      expect(getPerkSpec(perk).id).toBe(perk);
    }
  });

  it("activates sprint once and exposes duration and cooldown", () => {
    const runtime = createPerkRuntime("sprint");
    const result = tryActivatePerk(runtime, 1_000, { isMoving: true, isAlive: true });
    expect(result.activated).toBe(true);
    expect(result.runtime.activeUntil).toBe(2_500);
    expect(result.runtime.cooldownUntil).toBe(9_000);
    expect(result.runtime.speedMultiplier).toBe(1.5);
  });

  it("requires camouflage to begin while stationary", () => {
    const runtime = createPerkRuntime("camouflage");
    expect(tryActivatePerk(runtime, 1_000, { isMoving: true, isAlive: true }).activated).toBe(false);
    expect(tryActivatePerk(runtime, 1_000, { isMoving: false, isAlive: true }).activated).toBe(true);
  });

  it("does not offer an activation for passive or automatic perks", () => {
    expect(tryActivatePerk(createPerkRuntime("speedBoost"), 0, { isMoving: false, isAlive: true }).activated).toBe(false);
    expect(tryActivatePerk(createPerkRuntime("extraLife"), 0, { isMoving: false, isAlive: true }).activated).toBe(false);
  });
});
