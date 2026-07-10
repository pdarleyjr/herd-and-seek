import { describe, expect, it } from "vitest";

import { resolveShotTarget } from "./shotTarget";

describe("resolveShotTarget", () => {
  it("prefers the live touch aim target when touch controls are active", () => {
    const target = resolveShotTarget({
      showTouchControls: true,
      aimTarget: { worldX: 420, worldY: 315 },
      mouseTarget: { worldX: 50, worldY: 60 },
      localPos: { x: 100, y: 100 },
      aimAngle: 0,
    });

    expect(target).toEqual({ worldX: 420, worldY: 315 });
  });

  it("ignores stale aim targets on desktop and uses the mouse world position", () => {
    const target = resolveShotTarget({
      showTouchControls: false,
      aimTarget: { worldX: 420, worldY: 315 },
      mouseTarget: { worldX: 180, worldY: 240 },
      localPos: { x: 100, y: 100 },
      aimAngle: 0,
    });

    expect(target).toEqual({ worldX: 180, worldY: 240 });
  });

  it("falls back to the aim angle when no pointer target exists", () => {
    const target = resolveShotTarget({
      showTouchControls: false,
      aimTarget: null,
      mouseTarget: { worldX: 0, worldY: 0 },
      localPos: { x: 100, y: 100 },
      aimAngle: Math.PI / 2,
    });

    expect(target.worldX).toBeCloseTo(100);
    expect(target.worldY).toBeCloseTo(700);
  });
});
