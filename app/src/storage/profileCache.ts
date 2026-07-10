// Local cache for non-authoritative UI state and a *snapshot* of the player
// profile for instant boot.
//
// SECURITY: IndexedDB is NEVER authoritative for anything that affects the
// economy. Coins, badges, XP, purchases, quest reward grants, and admin status
// are owned by the server-side profile Durable Object. This cache is only ever
// used to render menus instantly while the authoritative profile is fetched;
// on reconnect the server profile always wins (see profileService.fetchProfile).

import type { PlayerProfile } from "../economy";

const DB_NAME = "herd-and-seek";
const STORE = "profiles";

// The cached profile is the full server-authorized shape. We never fabricate
// economy values locally — we only mirror what the server last told us.
export type CachedProfile = PlayerProfile;

// Non-authoritative, purely local UI preferences (never read by the server).
export interface LocalUiCache {
  lastSelectedMode?: "match" | "openWorld";
  graphicsSettings?: Record<string, unknown>;
  openWorldZonePosition?: { zoneId: string; x: number; y: number };
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "userId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readCachedProfile(userId: string): Promise<CachedProfile | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(userId);
      req.onsuccess = () => resolve((req.result as CachedProfile) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeCachedProfile(profile: CachedProfile): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(profile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

const UI_CACHE_KEY = "__local_ui_cache__";

export async function readLocalUiCache(): Promise<LocalUiCache> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(UI_CACHE_KEY);
      req.onsuccess = () => resolve((req.result as { value?: LocalUiCache })?.value ?? {});
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

export async function writeLocalUiCache(cache: LocalUiCache): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ userId: UI_CACHE_KEY, value: cache });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
