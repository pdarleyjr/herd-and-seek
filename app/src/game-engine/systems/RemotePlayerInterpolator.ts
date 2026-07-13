import type { Vector2Like } from "../types";

export interface PositionSnapshot extends Vector2Like {
  timestamp: number;
  sequence: number;
}

export class RemotePlayerInterpolator {
  private readonly buffers = new Map<string, PositionSnapshot[]>();
  private readonly interpolationDelayMs: number;
  private readonly maxSnapshots: number;

  constructor(interpolationDelayMs = 100, maxSnapshots = 20) {
    this.interpolationDelayMs = interpolationDelayMs;
    this.maxSnapshots = maxSnapshots;
  }

  push(playerId: string, snapshot: PositionSnapshot): void {
    if (!Number.isFinite(snapshot.x) || !Number.isFinite(snapshot.y) || !Number.isFinite(snapshot.timestamp)) return;
    const buffer = this.buffers.get(playerId) ?? [];
    if (buffer.some((item) => item.sequence >= snapshot.sequence)) return;
    buffer.push(snapshot);
    if (buffer.length > this.maxSnapshots) buffer.splice(0, buffer.length - this.maxSnapshots);
    this.buffers.set(playerId, buffer);
  }

  sample(playerId: string, now: number): Vector2Like | null {
    const buffer = this.buffers.get(playerId);
    if (!buffer?.length) return null;
    const renderAt = now - this.interpolationDelayMs;
    if (renderAt <= buffer[0].timestamp) return { x: buffer[0].x, y: buffer[0].y };
    const latest = buffer[buffer.length - 1];
    if (renderAt >= latest.timestamp) return { x: latest.x, y: latest.y };

    for (let index = 1; index < buffer.length; index += 1) {
      const next = buffer[index];
      const previous = buffer[index - 1];
      if (renderAt <= next.timestamp) {
        const span = Math.max(1, next.timestamp - previous.timestamp);
        const amount = Math.min(1, Math.max(0, (renderAt - previous.timestamp) / span));
        return {
          x: previous.x + (next.x - previous.x) * amount,
          y: previous.y + (next.y - previous.y) * amount,
        };
      }
    }
    return { x: latest.x, y: latest.y };
  }

  remove(playerId: string): void {
    this.buffers.delete(playerId);
  }

  clear(): void {
    this.buffers.clear();
  }

  bufferSize(playerId: string): number {
    return this.buffers.get(playerId)?.length ?? 0;
  }
}
