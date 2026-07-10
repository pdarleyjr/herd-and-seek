// Shared client-side economy config. Pricing is mirrored & enforced by the
// worker (worker/src/index.ts SHOP_CATALOG) — the client copy is for display
// only. All balance mutations happen server-side in the profile Durable Object.

export interface MatchStats {
  matches: number;
  wins: number;
  losses: number;
  tags: number;
  survivals: number;
}

export interface PlayerProfile {
  userId: string;
  username: string;
  xp: number;
  level: number;
  coins: number;
  badges: number;
  ownedCosmetics: string[];
  selectedCosmetic: string | null;
  stats: MatchStats;
  settings: Record<string, unknown>;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

export type CosmeticKind = "trail" | "nameplate" | "hat" | "crown";

export interface CosmeticDef {
  id: string;
  name: string;
  kind: CosmeticKind;
  price: number;
  currency: "coins" | "badges";
  emoji: string;
  description: string;
}

export const SHOP_ITEMS: CosmeticDef[] = [
  { id: "trail_leaf", name: "Leaf Trail", kind: "trail", price: 120, currency: "coins", emoji: "🍃", description: "Leaves flutter behind you." },
  { id: "trail_bubbles", name: "Bubble Trail", kind: "trail", price: 120, currency: "coins", emoji: "🫧", description: "Bubbles drift in your wake." },
  { id: "trail_dust", name: "Dust Trail", kind: "trail", price: 120, currency: "coins", emoji: "💨", description: "Kick up savannah dust." },
  { id: "nameplate_bronze", name: "Bronze Nameplate", kind: "nameplate", price: 200, currency: "coins", emoji: "🥉", description: "A bronze frame for your name." },
  { id: "nameplate_gold", name: "Gold Nameplate", kind: "nameplate", price: 600, currency: "coins", emoji: "🏅", description: "A gleaming gold nameplate." },
  { id: "hat_safari", name: "Safari Hat", kind: "hat", price: 350, currency: "coins", emoji: "🎩", description: "A rugged explorer's hat." },
  { id: "crown_prestige", name: "Prestige Crown", kind: "crown", price: 3, currency: "badges", emoji: "👑", description: "Only for badge-earning veterans." },
];

export const SHOP_BY_ID: Record<string, CosmeticDef> = SHOP_ITEMS.reduce(
  (acc, item) => { acc[item.id] = item; return acc; },
  {} as Record<string, CosmeticDef>,
);

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.4));
}

// Progress toward the next level, 0..1, for HUD progress bars.
export function levelProgress(profile: PlayerProfile): number {
  const cur = xpForLevel(profile.level);
  const next = xpForLevel(profile.level + 1);
  if (next <= cur) return 0;
  return Math.max(0, Math.min(1, (profile.xp - cur) / (next - cur)));
}
