export class WorldObjectPool<T> {
  private readonly available: T[] = [];
  private readonly active = new Set<T>();
  private readonly factory: () => T;
  private readonly reset: (item: T) => void;
  private readonly maxSize: number;
  constructor(factory: () => T, reset: (item: T) => void, maxSize = 128) { this.factory = factory; this.reset = reset; this.maxSize = maxSize; }
  acquire(): T | null { if (this.active.size >= this.maxSize) return null; const item = this.available.pop() ?? this.factory(); this.active.add(item); return item; }
  release(item: T): void { if (!this.active.delete(item)) return; this.reset(item); this.available.push(item); }
  releaseAll(): void { for (const item of [...this.active]) this.release(item); }
  counts(): { active: number; available: number } { return { active: this.active.size, available: this.available.length }; }
}
