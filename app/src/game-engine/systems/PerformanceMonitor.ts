export class PerformanceMonitor {
  private elapsed = 0;
  private frames = 0;
  private lastFps = 60;

  tick(deltaMs: number): number | null {
    this.elapsed += deltaMs;
    this.frames += 1;
    if (this.elapsed < 1_000) return null;
    this.lastFps = Math.round((this.frames * 1_000) / this.elapsed);
    this.elapsed = 0;
    this.frames = 0;
    return this.lastFps;
  }

  get fps(): number { return this.lastFps; }
}
