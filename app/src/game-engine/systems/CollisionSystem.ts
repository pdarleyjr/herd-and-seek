import { WORLD_SIZE } from "../../types";
import type { Vector2Like } from "../types";

export function clampToWorld(position: Vector2Like, padding = 36): Vector2Like {
  return {
    x: Math.max(padding, Math.min(WORLD_SIZE - padding, position.x)),
    y: Math.max(padding, Math.min(WORLD_SIZE - padding, position.y)),
  };
}
