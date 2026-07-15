import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTROL_SETTINGS, readControlSettings, writeControlSettings } from "./ControlSettings";

describe("tablet control settings", () => {
  beforeEach(() => localStorage.clear());

  it("uses touch-friendly defaults", () => {
    expect(readControlSettings()).toEqual(DEFAULT_CONTROL_SETTINGS);
    expect(DEFAULT_CONTROL_SETTINGS.scale).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_CONTROL_SETTINGS.opacity).toBeGreaterThanOrEqual(0.65);
  });

  it("persists handedness, joystick mode, scale, and opacity with safe bounds", () => {
    const saved = writeControlSettings({ handedness: "left", joystick: "floating", scale: 1.8, opacity: 0.2 });
    expect(saved).toEqual({ handedness: "left", joystick: "floating", scale: 1.35, opacity: 0.45 });
    expect(readControlSettings()).toEqual(saved);
  });

  it("recovers from malformed storage", () => {
    localStorage.setItem("hs_control_settings", "not-json");
    expect(readControlSettings()).toEqual(DEFAULT_CONTROL_SETTINGS);
  });
});
