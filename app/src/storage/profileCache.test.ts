import { describe, it, expect } from "vitest";
import {
  readCachedProfile,
  writeCachedProfile,
  readLocalUiCache,
  writeLocalUiCache,
} from "./profileCache";

// jsdom has no IndexedDB, so the cache must degrade gracefully (never throw,
// never report a stale authoritative balance).
describe("profileCache (IndexedDB-backed, non-authoritative)", () => {
  it("readCachedProfile resolves null when storage is unavailable", async () => {
    const p = await readCachedProfile("u1");
    expect(p).toBeNull();
  });

  it("writeCachedProfile does not throw without storage", async () => {
    await expect(
      writeCachedProfile({
        userId: "u1",
        username: "T",
        xp: 0,
        level: 1,
        coins: 0,
        badges: 0,
        ownedCosmetics: [],
        selectedCosmetic: null,
        stats: { matches: 0, wins: 0, losses: 0, tags: 0, survivals: 0 },
        settings: {},
        isAdmin: false,
        createdAt: 0,
        updatedAt: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it("local UI cache read/write never throw and default to empty", async () => {
    const before = await readLocalUiCache();
    expect(before).toEqual({});
    await expect(writeLocalUiCache({ lastSelectedMode: "openWorld" })).resolves.toBeUndefined();
  });
});
