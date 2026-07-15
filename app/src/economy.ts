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
  loadout: LoadoutProfile;
  stats: MatchStats;
  settings: Record<string, unknown>;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LoadoutProfile {
  hunterTool: string;
  hunterSkin: string;
  reticle: string;
  trail: string;
  sound: string;
  animalSkins: Record<string, string>;
}

export type CosmeticKind = "trail" | "nameplate" | "hat" | "crown" | "hunterTool" | "hunterSkin" | "animalSkin" | "reticle" | "sound";

export interface CosmeticDef {
  id: string;
  name: string;
  kind: CosmeticKind;
  price: number;
  currency: "coins" | "badges";
  emoji: string;
  description: string;
  species?: string;
}

export const SHOP_ITEMS: CosmeticDef[] = [
  { id: "trail_leaf", name: "Leaf Trail", kind: "trail", price: 120, currency: "coins", emoji: "🍃", description: "Leaves flutter behind you." },
  { id: "trail_bubbles", name: "Bubble Trail", kind: "trail", price: 120, currency: "coins", emoji: "🫧", description: "Bubbles drift in your wake." },
  { id: "trail_dust", name: "Dust Trail", kind: "trail", price: 120, currency: "coins", emoji: "💨", description: "Kick up savannah dust." },
  { id: "nameplate_bronze", name: "Bronze Nameplate", kind: "nameplate", price: 200, currency: "coins", emoji: "🥉", description: "A bronze frame for your name." },
  { id: "nameplate_gold", name: "Gold Nameplate", kind: "nameplate", price: 600, currency: "coins", emoji: "🏅", description: "A gleaming gold nameplate." },
  { id: "hat_safari", name: "Safari Hat", kind: "hat", price: 350, currency: "coins", emoji: "🎩", description: "A rugged explorer's hat." },
  { id: "crown_prestige", name: "Prestige Crown", kind: "crown", price: 3, currency: "badges", emoji: "👑", description: "Only for badge-earning veterans." },
  { id: "tool_tranquilizer", name: "Moonfern Tranquilizer", kind: "hunterTool", price: 420, currency: "coins", emoji: "T", description: "A fictional quiet-tag carbine with a fernwood chassis." },
  { id: "tool_seedburst", name: "Seedburst Marker", kind: "hunterTool", price: 520, currency: "coins", emoji: "S", description: "A bright fictional field marker with a seed-pod barrel." },
  { id: "hunter_skin_moonfern", name: "Moonfern Ranger", kind: "hunterSkin", price: 360, currency: "coins", emoji: "R", description: "Deep-plum ranger kit with lagoon field panels." },
  { id: "reticle_sunring", name: "Sunring Reticle", kind: "reticle", price: 180, currency: "coins", emoji: "◎", description: "A high-contrast golden ring for clear tablet aiming." },
  { id: "shot_trail_firefly", name: "Firefly Trail", kind: "trail", price: 260, currency: "coins", emoji: "✦", description: "Warm light motes follow fictional tag rounds." },
  { id: "tool_sound_soft", name: "Softwood Report", kind: "sound", price: 140, currency: "coins", emoji: "♪", description: "A gentler fictional field-tool sound profile." },
  { id: "skin_rabbit_moonfern", name: "Moonfern Rabbit", kind: "animalSkin", species: "rabbit", price: 260, currency: "coins", emoji: "Rb", description: "Forest-violet fur and luminous fern markings." },
  { id: "skin_bear_honeyguard", name: "Honeyguard Bear", kind: "animalSkin", species: "bear", price: 300, currency: "coins", emoji: "Br", description: "Warm bark tones and a honey-gold shoulder mark." },
  { id: "skin_zebra_sunstripe", name: "Sunstripe Zebra", kind: "animalSkin", species: "zebra", price: 300, currency: "coins", emoji: "Zb", description: "Savannah-coral stripes with a dusk-blue mane." },
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
