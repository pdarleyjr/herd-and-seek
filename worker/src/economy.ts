// Pure, side-effect-free economy + ledger logic for the profile Durable Object.
// Kept free of Durable Object state so it can be unit-tested in isolation.
// All balance mutations MUST flow through these helpers so an immutable ledger
// entry is produced. Never mutate profile.coins/badges/xp directly elsewhere.

export interface MatchStats {
  matches: number;
  wins: number;
  losses: number;
  tags: number; // animals neutralized as hunter
  survivals: number; // matches survived as animal
}

// Immutable, append-only economic audit record.
export type LedgerSource =
  | "match_reward"
  | "quest_reward"
  | "collectible"
  | "purchase"
  | "admin_grant"
  | "refund";

export interface EconomyLedgerEntry {
  id: string;
  ts: number;
  userId: string;
  source: LedgerSource;
  deltaCoins: number;
  deltaBadges: number;
  deltaXp: number;
  balanceAfter: { coins: number; badges: number; xp: number };
  metadata?: Record<string, unknown>;
}

export interface CosmeticDef {
  id: string;
  price: number; // in coins
  currency: "coins" | "badges";
}

// Server-authoritative pricing. Mirrored (display only) in app/src/economy.ts.
export const SHOP_CATALOG: Record<string, CosmeticDef> = {
  trail_leaf: { id: "trail_leaf", price: 120, currency: "coins" },
  trail_bubbles: { id: "trail_bubbles", price: 120, currency: "coins" },
  trail_dust: { id: "trail_dust", price: 120, currency: "coins" },
  nameplate_bronze: { id: "nameplate_bronze", price: 200, currency: "coins" },
  nameplate_gold: { id: "nameplate_gold", price: 600, currency: "coins" },
  hat_safari: { id: "hat_safari", price: 350, currency: "coins" },
  crown_prestige: { id: "crown_prestige", price: 3, currency: "badges" },
  // Open-world consumables (utility sidegrades — never competitive pay-to-win).
  ow_speed_boost: { id: "ow_speed_boost", price: 150, currency: "coins" },
  ow_reveal: { id: "ow_reveal", price: 100, currency: "coins" },
  ow_quest_slot: { id: "ow_quest_slot", price: 250, currency: "coins" },
};

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.4));
}

export function recomputeLevel(profile: { xp: number; level: number }): void {
  let level = 1;
  while (profile.xp >= xpForLevel(level + 1)) level++;
  profile.level = level;
}

export function newProfile(userId: string, username: string) {
  const now = Date.now();
  return {
    userId,
    username: username || "Anonymous",
    xp: 0,
    level: 1,
    coins: 50, // small welcome grant
    badges: 0,
    ownedCosmetics: [] as string[],
    selectedCosmetic: null as string | null,
    unlockedAbilities: [] as string[],
    questProgress: {} as Record<string, unknown>,
    dailyQuestDate: "",
    openWorld: {
      lastZoneId: null as string | null,
      lastX: 1500,
      lastY: 1500,
      discoveredZones: [] as string[],
      collectedNodeIds: [] as string[],
    },
    stats: {
      matches: 0,
      wins: 0,
      losses: 0,
      tags: 0,
      survivals: 0,
      openWorldMinutes: 0,
      questsCompleted: 0,
      collectiblesFound: 0,
    },
    economyLedger: [] as EconomyLedgerEntry[],
    settings: {},
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Authorization helpers ────────────────────────────────────────────────────

// Server-to-server reward calls (match results, quest claims, collectibles)
// must carry the INTERNAL_REWARD_SECRET. The browser can never present it.
export function requireInternalRewardAuth(request: Request, env: EnvLike): boolean {
  const secret = env.INTERNAL_REWARD_SECRET;
  if (!secret) return false; // misconfigured worker -> deny all reward grants
  const header =
    request.headers.get("x-internal-reward-secret") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    "";
  return header === secret;
}

// Admin actions require the ADMIN_KEY secret. If the secret is not configured
// (production should set it via `wrangler secret put ADMIN_KEY`), admin is
// fully disabled.
export function requireAdminKey(key: string | undefined, env: EnvLike): boolean {
  if (!env.ADMIN_KEY) return false;
  return Boolean(key) && key === env.ADMIN_KEY;
}

export interface EnvLike {
  ADMIN_KEY?: string;
  INTERNAL_REWARD_SECRET?: string;
}

// ── Mutation helpers (each returns the ledger entry it wrote) ─────────────────

function ledger(
  profile: ProfileLike,
  source: LedgerSource,
  delta: { coins: number; badges: number; xp: number },
  metadata?: Record<string, unknown>,
): EconomyLedgerEntry {
  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    userId: profile.userId,
    source,
    deltaCoins: delta.coins,
    deltaBadges: delta.badges,
    deltaXp: delta.xp,
    balanceAfter: { coins: profile.coins, badges: profile.badges, xp: profile.xp },
    metadata,
  };
}

export interface ProfileLike {
  userId: string;
  coins: number;
  badges: number;
  xp: number;
  level: number;
  ownedCosmetics: string[];
  selectedCosmetic: string | null;
  isAdmin: boolean;
  updatedAt: number;
  economyLedger: EconomyLedgerEntry[];
  stats: MatchStats & {
    openWorldMinutes: number;
    questsCompleted: number;
    collectiblesFound: number;
  };
}

export interface RewardBody {
  coins?: number;
  badges?: number;
  xp?: number;
  stat?: Partial<MatchStats>;
  source?: LedgerSource;
  metadata?: Record<string, unknown>;
}

// Internal-only. Caller MUST have passed requireInternalRewardAuth first.
export function applyReward(profile: ProfileLike, body: RewardBody): EconomyLedgerEntry {
  const coins = Math.max(0, Math.floor(body.coins ?? 0));
  const badges = Math.max(0, Math.floor(body.badges ?? 0));
  const xp = Math.max(0, Math.floor(body.xp ?? 0));
  profile.coins += coins;
  profile.badges += badges;
  profile.xp += xp;
  if (body.stat) {
    const s = profile.stats;
    s.matches += body.stat.matches ?? 0;
    s.wins += body.stat.wins ?? 0;
    s.losses += body.stat.losses ?? 0;
    s.tags += body.stat.tags ?? 0;
    s.survivals += body.stat.survivals ?? 0;
  }
  recomputeLevel(profile);
  profile.updatedAt = Date.now();
  const entry = ledger(profile, body.source ?? "match_reward", { coins, badges, xp }, body.metadata);
  profile.economyLedger.push(entry);
  return entry;
}

export interface PurchaseResult {
  ok: boolean;
  error?: "unknown_item" | "already_owned" | "insufficient_funds";
  entry?: EconomyLedgerEntry;
}

export function applyPurchase(profile: ProfileLike, cosmeticId: string): PurchaseResult {
  const item = SHOP_CATALOG[cosmeticId];
  if (!item) return { ok: false, error: "unknown_item" };
  if (profile.ownedCosmetics.includes(item.id)) return { ok: false, error: "already_owned" };
  const balance = item.currency === "coins" ? profile.coins : profile.badges;
  if (balance < item.price) return { ok: false, error: "insufficient_funds" };
  if (item.currency === "coins") profile.coins -= item.price;
  else profile.badges -= item.price;
  profile.ownedCosmetics.push(item.id);
  if (!profile.selectedCosmetic) profile.selectedCosmetic = item.id;
  recomputeLevel(profile);
  profile.updatedAt = Date.now();
  const entry = ledger(profile, "purchase", {
    coins: item.currency === "coins" ? -item.price : 0,
    badges: item.currency === "badges" ? -item.price : 0,
    xp: 0,
  }, { cosmeticId: item.id });
  profile.economyLedger.push(entry);
  return { ok: true, entry };
}

// Selecting a cosmetic is a profile preference, not a balance change — no ledger
// entry required, but it still must be server-validated (only owned items).
export function applySelect(profile: ProfileLike, cosmeticId: string | null): boolean {
  if (cosmeticId === null || profile.ownedCosmetics.includes(cosmeticId)) {
    profile.selectedCosmetic = cosmeticId;
    profile.updatedAt = Date.now();
    return true;
  }
  return false;
}

export interface AdminGrantBody {
  coins?: number;
  badges?: number;
  xp?: number;
  makeAdmin?: boolean;
}

export function applyAdminGrant(
  profile: ProfileLike,
  body: AdminGrantBody,
): EconomyLedgerEntry {
  const coins = Math.floor(body.coins ?? 0);
  const badges = Math.floor(body.badges ?? 0);
  const xp = Math.floor(body.xp ?? 0);
  profile.coins = Math.max(0, profile.coins + coins);
  profile.badges = Math.max(0, profile.badges + badges);
  profile.xp = Math.max(0, profile.xp + xp);
  if (typeof body.makeAdmin === "boolean") profile.isAdmin = body.makeAdmin;
  recomputeLevel(profile);
  profile.updatedAt = Date.now();
  const entry = ledger(profile, "admin_grant", { coins, badges, xp }, {
    makeAdmin: body.makeAdmin,
  });
  profile.economyLedger.push(entry);
  return entry;
}

// Cap ledger growth so storage stays bounded (keep most recent N).
export function trimLedger(profile: ProfileLike, max = 200): void {
  if (profile.economyLedger.length > max) {
    profile.economyLedger = profile.economyLedger.slice(-max);
  }
}

// ── Open-world idempotency / reset helpers ───────────────────────────────────
import type { QuestProgress, QuestDefinition } from "./index";

// Idempotent quest claim: only grants the reward once. If the quest is not in a
// "complete" state (or was already claimed), this is a no-op — so replaying a
// CLAIM message can never double-pay.
export function applyQuestClaim(
  profile: ProfileLike,
  def: QuestDefinition,
  current: QuestProgress | undefined,
): { changed: boolean; entry?: EconomyLedgerEntry } {
  if (!current || current.status !== "complete") return { changed: false };
  current.status = "claimed";
  current.claimedAt = Date.now();
  const entry = applyReward(profile, {
    coins: def.reward.coins,
    badges: def.reward.badges ?? 0,
    xp: def.reward.xp,
    source: "quest_reward",
    metadata: { questId: def.id },
  });
  return { changed: true, entry };
}

// A collectible node is grantable only when it is not currently in its respawn
// cooldown. After collection the server sets respawnAt, so a second COLLECT_NODE
// for the same node within the same cycle grants nothing (no double-pay).
export function collectibleGrantable(respawnAt: number | undefined, now: number): boolean {
  return !(respawnAt && respawnAt > now);
}

// Daily quests reset when the UTC date changes.
export function dueDailyReset(dailyQuestDate: string, today: string): boolean {
  return dailyQuestDate !== today;
}
