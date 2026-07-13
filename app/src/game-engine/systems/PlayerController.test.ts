import { describe, expect, it } from "vitest";
import { calculateMovementStep } from "./PlayerController";

describe("player movement", () => {
  it.each([30, 60, 75, 120, 144])("travels the same distance at %i Hz", (hz) => {
    let x = 0;
    let y = 0;
    for (let frame = 0; frame < hz; frame += 1) {
      const step = calculateMovementStep({ x: 1, y: 0 }, 240, 1000 / hz);
      x += step.x;
      y += step.y;
    }
    expect(x).toBeCloseTo(240, 5);
    expect(y).toBe(0);
  });

  it("normalizes diagonal movement", () => {
    const horizontal = calculateMovementStep({ x: 1, y: 0 }, 240, 1000);
    const diagonal = calculateMovementStep({ x: 1, y: 1 }, 240, 1000);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(Math.hypot(horizontal.x, horizontal.y), 5);
  });

  it("bounds long frame deltas", () => {
    const step = calculateMovementStep({ x: 1, y: 0 }, 240, 10_000);
    expect(step.x).toBe(24);
  });
});
