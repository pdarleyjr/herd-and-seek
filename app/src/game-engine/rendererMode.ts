export type RendererMode = "legacy" | "phaser";

export function resolveRendererMode(value: unknown): RendererMode {
  return value === "legacy" ? "legacy" : "phaser";
}
