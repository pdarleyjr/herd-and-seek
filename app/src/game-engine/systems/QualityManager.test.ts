import { describe, expect, it } from "vitest";
import { qualitySettingsFor } from "./QualityManager";

describe("quality tiers", () => {
  it("reduces expensive effects without removing gameplay information", () => {
    const high = qualitySettingsFor("high");
    const battery = qualitySettingsFor("battery");
    expect(high.particleBudget).toBeGreaterThan(battery.particleBudget);
    expect(high.renderScale).toBeGreaterThan(battery.renderScale);
    expect(battery.showAimReticle).toBe(true);
    expect(battery.showInteractivePrompts).toBe(true);
  });
});
