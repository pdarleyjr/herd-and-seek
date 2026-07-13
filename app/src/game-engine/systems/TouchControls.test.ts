import { describe, expect, it } from "vitest";
import { TouchControls } from "./TouchControls";

describe("TouchControls", () => {
  it("normalizes a captured pointer and resets on cancellation", () => {
    const controls = new TouchControls(); controls.begin(4, 10, 10);
    expect(controls.move(4, 70, 10)).toEqual({ x: 1, y: 0 });
    controls.end(4); expect(controls.value()).toEqual({ x: 0, y: 0 });
  });
});
