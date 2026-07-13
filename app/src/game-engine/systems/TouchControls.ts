import type { Vector2Like } from "../types";

export class TouchControls {
  private pointerId: number | null = null;
  private origin: Vector2Like = { x: 0, y: 0 };
  private vector: Vector2Like = { x: 0, y: 0 };

  begin(pointerId: number, x: number, y: number): void { this.pointerId = pointerId; this.origin = { x, y }; this.vector = { x: 0, y: 0 }; }
  move(pointerId: number, x: number, y: number, radius = 60): Vector2Like {
    if (pointerId !== this.pointerId) return this.vector;
    const dx = x - this.origin.x; const dy = y - this.origin.y; const distance = Math.hypot(dx, dy);
    const strength = Math.min(1, distance / Math.max(1, radius));
    this.vector = distance > 7 ? { x: dx / distance * strength, y: dy / distance * strength } : { x: 0, y: 0 };
    return this.vector;
  }
  value(): Vector2Like { return { ...this.vector }; }
  end(pointerId?: number): void { if (pointerId === undefined || pointerId === this.pointerId) { this.pointerId = null; this.vector = { x: 0, y: 0 }; } }
}
