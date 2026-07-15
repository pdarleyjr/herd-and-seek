export type ControlHandedness = "right" | "left";
export type JoystickMode = "fixed" | "floating";

export interface ControlSettings {
  handedness: ControlHandedness;
  joystick: JoystickMode;
  scale: number;
  opacity: number;
}

export const CONTROL_SETTINGS_KEY = "hs_control_settings";

export const DEFAULT_CONTROL_SETTINGS: Readonly<ControlSettings> = Object.freeze({
  handedness: "right",
  joystick: "fixed",
  scale: 1,
  opacity: 0.82,
});

export function readControlSettings(): ControlSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_CONTROL_SETTINGS };
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTROL_SETTINGS_KEY) ?? "null") as Partial<ControlSettings> | null;
    return normalizeControlSettings(parsed ?? {});
  } catch {
    return { ...DEFAULT_CONTROL_SETTINGS };
  }
}

export function writeControlSettings(settings: Partial<ControlSettings>): ControlSettings {
  const next = normalizeControlSettings({ ...readControlSettings(), ...settings });
  if (typeof localStorage !== "undefined") localStorage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hs-control-settings", { detail: next }));
  return next;
}

export function normalizeControlSettings(settings: Partial<ControlSettings>): ControlSettings {
  return {
    handedness: settings.handedness === "left" ? "left" : "right",
    joystick: settings.joystick === "floating" ? "floating" : "fixed",
    scale: clamp(typeof settings.scale === "number" ? settings.scale : DEFAULT_CONTROL_SETTINGS.scale, 0.8, 1.35),
    opacity: clamp(typeof settings.opacity === "number" ? settings.opacity : DEFAULT_CONTROL_SETTINGS.opacity, 0.45, 1),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(value * 100) / 100));
}
