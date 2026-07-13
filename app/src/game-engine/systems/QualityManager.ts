import type { QualityTier } from "../types";

export interface QualitySettings {
  renderScale: number;
  particleBudget: number;
  foliageDensity: number;
  shadows: boolean;
  postFx: boolean;
  showAimReticle: true;
  showInteractivePrompts: true;
}

const SETTINGS: Record<QualityTier, QualitySettings> = {
  high: { renderScale: 1, particleBudget: 180, foliageDensity: 1, shadows: true, postFx: true, showAimReticle: true, showInteractivePrompts: true },
  balanced: { renderScale: 0.85, particleBudget: 90, foliageDensity: 0.72, shadows: true, postFx: false, showAimReticle: true, showInteractivePrompts: true },
  battery: { renderScale: 0.68, particleBudget: 30, foliageDensity: 0.42, shadows: false, postFx: false, showAimReticle: true, showInteractivePrompts: true },
};

export function qualitySettingsFor(tier: QualityTier): QualitySettings {
  return SETTINGS[tier];
}

export function recommendQuality(devicePixelRatio: number, hardwareConcurrency: number): QualityTier {
  if (hardwareConcurrency <= 4 || devicePixelRatio >= 3) return "battery";
  if (hardwareConcurrency <= 8 || devicePixelRatio >= 2) return "balanced";
  return "high";
}
