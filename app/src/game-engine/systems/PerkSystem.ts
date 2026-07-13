import type { PerkType } from "../../types";

export interface PerkSpec {
  id: PerkType;
  label: string;
  kind: "active" | "passive" | "automatic" | "none";
  durationMs: number;
  cooldownMs: number;
  speedMultiplier: number;
  requiresStationary: boolean;
  oneUse: boolean;
}

export interface PerkRuntime {
  perk: PerkType;
  activeUntil: number;
  cooldownUntil: number;
  speedMultiplier: number;
  consumed: boolean;
}

const SPECS: Record<PerkType, PerkSpec> = {
  none: { id: "none", label: "No Perk", kind: "none", durationMs: 0, cooldownMs: 0, speedMultiplier: 1, requiresStationary: false, oneUse: false },
  sprint: { id: "sprint", label: "Sprinting Dash", kind: "active", durationMs: 1_500, cooldownMs: 8_000, speedMultiplier: 1.5, requiresStationary: false, oneUse: false },
  camouflage: { id: "camouflage", label: "Camouflage Freeze", kind: "active", durationMs: 3_000, cooldownMs: 10_000, speedMultiplier: 0, requiresStationary: true, oneUse: false },
  extraLife: { id: "extraLife", label: "Extra Life", kind: "automatic", durationMs: 0, cooldownMs: 0, speedMultiplier: 1, requiresStationary: false, oneUse: true },
  decoy: { id: "decoy", label: "Decoy Drop", kind: "active", durationMs: 8_000, cooldownMs: 12_000, speedMultiplier: 1, requiresStationary: false, oneUse: false },
  speedBoost: { id: "speedBoost", label: "Speed Boost", kind: "passive", durationMs: 0, cooldownMs: 0, speedMultiplier: 1.3, requiresStationary: false, oneUse: false },
};

export function getPerkSpec(perk: PerkType): PerkSpec {
  return SPECS[perk];
}

export function createPerkRuntime(perk: PerkType): PerkRuntime {
  const spec = getPerkSpec(perk);
  return { perk, activeUntil: 0, cooldownUntil: 0, speedMultiplier: spec.kind === "passive" ? spec.speedMultiplier : 1, consumed: false };
}

export function tryActivatePerk(
  runtime: PerkRuntime,
  now: number,
  state: { isMoving: boolean; isAlive: boolean },
): { activated: boolean; reason?: "dead" | "cooldown" | "stationary" | "passive" | "consumed"; runtime: PerkRuntime } {
  const spec = getPerkSpec(runtime.perk);
  if (!state.isAlive) return { activated: false, reason: "dead", runtime };
  if (spec.kind !== "active") return { activated: false, reason: "passive", runtime };
  if (runtime.consumed) return { activated: false, reason: "consumed", runtime };
  if (runtime.cooldownUntil > now) return { activated: false, reason: "cooldown", runtime };
  if (spec.requiresStationary && state.isMoving) return { activated: false, reason: "stationary", runtime };

  return {
    activated: true,
    runtime: {
      ...runtime,
      activeUntil: now + spec.durationMs,
      cooldownUntil: now + spec.cooldownMs,
      speedMultiplier: spec.speedMultiplier,
      consumed: spec.oneUse,
    },
  };
}
