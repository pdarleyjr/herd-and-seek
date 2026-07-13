// Player profile client service.
//
// Persistence architecture (per the audit): the authoritative profile lives in
// a Cloudflare Durable Object; we cache the last-known profile in IndexedDB for
// instant boot / offline-friendly menus and reconcile with the server whenever
// we can reach it. The cache is implemented in ./storage/profileCache and is
// never authoritative for economy values.
import type { PlayerProfile } from "./economy";
import {
  readCachedProfile,
  writeCachedProfile,
} from "./storage/profileCache";

import { BACKEND_ORIGIN } from "./backend";

const API_BASE = `${BACKEND_ORIGIN}/api/profile`;

export { readCachedProfile, writeCachedProfile };

async function apiCall(
  action: string,
  userId: string,
  username: string,
  body?: unknown,
): Promise<PlayerProfile | null> {
  const qs = new URLSearchParams({ action, userId, username });
  try {
    const res = await fetch(`${API_BASE}?${qs.toString()}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as
      | (PlayerProfile & { error?: string })
      | null;
    if (!data) return null;
    if ((data as { error?: string }).error && !data.userId) return null;
    const profile = data as PlayerProfile;
    if (profile.userId) await writeCachedProfile(profile);
    return profile;
  } catch {
    return null;
  }
}

// Fetch profile from the server, falling back to the IndexedDB snapshot when
// offline. Always returns something usable so menus never block on the network.
export async function fetchProfile(userId: string, username: string): Promise<PlayerProfile | null> {
  const server = await apiCall("get", userId, username);
  if (server) return server;
  return readCachedProfile(userId);
}

export async function purchaseCosmetic(
  userId: string,
  username: string,
  cosmeticId: string,
): Promise<{ ok: boolean; profile: PlayerProfile | null; error?: string }> {
  const qs = new URLSearchParams({ action: "purchase", userId, username });
  try {
    const res = await fetch(`${API_BASE}?${qs.toString()}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cosmeticId }),
    });
    const data = (await res.json().catch(() => null)) as
      | (PlayerProfile & { error?: string })
      | null;
      if (data && data.userId) {
        await writeCachedProfile(data);
        return { ok: !("error" in data && data.error), profile: data, error: (data as { error?: string }).error };
      }
    return { ok: false, profile: null, error: data?.error ?? "network_error" };
  } catch {
    return { ok: false, profile: null, error: "network_error" };
  }
}

export async function selectCosmetic(
  userId: string,
  username: string,
  cosmeticId: string | null,
): Promise<PlayerProfile | null> {
  return apiCall("select", userId, username, { cosmeticId });
}
