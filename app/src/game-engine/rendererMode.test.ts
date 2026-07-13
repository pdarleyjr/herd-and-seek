import { describe, expect, it } from "vitest";
import { resolveRendererMode } from "./rendererMode";

describe("renderer rollback switch", () => {
  it("defaults to Phaser", () => {
    expect(resolveRendererMode(undefined)).toBe("phaser");
  });

  it("keeps the explicit legacy rollback path", () => {
    expect(resolveRendererMode("legacy")).toBe("legacy");
  });

  it("fails safe to Phaser for unsupported values", () => {
    expect(resolveRendererMode("canvas-2d")).toBe("phaser");
  });
});
