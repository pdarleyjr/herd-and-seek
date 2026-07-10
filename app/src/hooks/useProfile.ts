import { useCallback, useEffect, useState } from "react";
import type { PlayerProfile } from "../economy";
import { fetchProfile, readCachedProfile } from "../profileService";

// Loads the player's persistent profile (coins, badges, XP, cosmetics) and
// keeps a live copy in React state. Boots instantly from the IndexedDB cache
// then reconciles with the authoritative server profile.
export function useProfile(userId: string, username: string) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !username) return;
    const next = await fetchProfile(userId, username);
    if (next) setProfile(next);
  }, [userId, username]);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !username) return;

    // Boot from cache, then reconcile with the server. All setState calls
    // happen inside async continuations, never synchronously in the effect body.
    (async () => {
      const cached = await readCachedProfile(userId);
      if (!cancelled && cached) setProfile(cached);
      const server = await fetchProfile(userId, username);
      if (!cancelled && server) setProfile(server);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, username]);

  return { profile, setProfile, refresh };
}
