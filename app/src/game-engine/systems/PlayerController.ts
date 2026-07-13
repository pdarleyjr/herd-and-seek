import type { Vector2Like } from "../types";

export const MAX_FRAME_DELTA_MS = 100;

export function normalizeInput(input: Vector2Like): Vector2Like {
  const length = Math.hypot(input.x, input.y);
  if (!Number.isFinite(length) || length === 0) return { x: 0, y: 0 };
  if (length <= 1) return input;
  return { x: input.x / length, y: input.y / length };
}

export function calculateMovementStep(input: Vector2Like, unitsPerSecond: number, deltaMs: number): Vector2Like {
  const direction = normalizeInput(input);
  const boundedDelta = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, deltaMs));
  const distance = Math.max(0, unitsPerSecond) * (boundedDelta / 1000);
  return { x: direction.x * distance, y: direction.y * distance };
}

export function reconcilePosition(
  predicted: Vector2Like,
  authoritative: Vector2Like,
  softThreshold = 12,
  hardThreshold = 180,
): Vector2Like {
  const error = Math.hypot(authoritative.x - predicted.x, authoritative.y - predicted.y);
  if (error >= hardThreshold) return { ...authoritative };
  if (error <= softThreshold) return predicted;
  return {
    x: predicted.x + (authoritative.x - predicted.x) * 0.18,
    y: predicted.y + (authoritative.y - predicted.y) * 0.18,
  };
}
