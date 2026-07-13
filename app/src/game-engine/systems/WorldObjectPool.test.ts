import { describe, expect, it } from "vitest";
import { WorldObjectPool } from "./WorldObjectPool";

describe("WorldObjectPool", () => {
  it("bounds allocations and reuses released world objects", () => {
    let created = 0; const pool = new WorldObjectPool(() => ({ id: ++created }), () => {}, 1);
    const first = pool.acquire(); expect(pool.acquire()).toBeNull(); pool.release(first!);
    expect(pool.acquire()).toBe(first); expect(created).toBe(1);
  });
});
