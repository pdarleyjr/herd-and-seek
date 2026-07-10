export type AssetKey =
  | "hunter" | "survivor"
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake"
  | "tree" | "treeBrown" | "bush";

export type AssetMap = Partial<Record<AssetKey, HTMLImageElement>>;

const ASSET_PATHS: Record<AssetKey, string> = {
  hunter: "/assets/hunter.png",
  survivor: "/assets/survivor.png",
  elephant: "/assets/elephant.png",
  penguin: "/assets/penguin.png",
  monkey: "/assets/monkey.png",
  giraffe: "/assets/giraffe.png",
  bear: "/assets/bear.png",
  dog: "/assets/dog.png",
  frog: "/assets/frog.png",
  horse: "/assets/horse.png",
  pig: "/assets/pig.png",
  rabbit: "/assets/rabbit.png",
  cow: "/assets/cow.png",
  duck: "/assets/duck.png",
  panda: "/assets/panda.png",
  parrot: "/assets/parrot.png",
  owl: "/assets/owl.png",
  snake: "/assets/snake.png",
  tree: "/assets/tree.png",
  treeBrown: "/assets/treeBrown.png",
  bush: "/assets/bush.png",
};

const FOREST_ASSET_KEYS: AssetKey[] = [
  "hunter",
  "survivor",
  "elephant",
  "penguin",
  "monkey",
  "giraffe",
  "bear",
  "dog",
  "frog",
  "horse",
  "pig",
  "rabbit",
  "cow",
  "duck",
  "panda",
  "parrot",
  "owl",
  "snake",
  "tree",
  "treeBrown",
  "bush",
];

const ASSET_GROUPS = {
  forest: FOREST_ASSET_KEYS,
  deepDark: [] as AssetKey[],
  savannah: [] as AssetKey[],
} as const;

export type BiomeId = keyof typeof ASSET_GROUPS;

// Per-biome asset manifest. The client only requests the art a given level
// actually needs; procedural biomes (ocean, savannah) ship no bitmap assets.
export const BIOME_MANIFEST: Record<BiomeId, { keys: readonly AssetKey[]; procedural: boolean }> = {
  forest: { keys: FOREST_ASSET_KEYS, procedural: false },
  deepDark: { keys: [], procedural: true },
  savannah: { keys: [], procedural: true },
};

const assetCache = new Map<AssetKey, HTMLImageElement>();
const assetPromises = new Map<AssetKey, Promise<HTMLImageElement>>();
const groupCache = new Map<keyof typeof ASSET_GROUPS, AssetMap>();

function loadAsset(key: AssetKey): Promise<HTMLImageElement> {
  const cached = assetCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = assetPromises.get(key);
  if (pending) return pending;

  const src = ASSET_PATHS[key];
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      assetCache.set(key, img);
      assetPromises.delete(key);
      resolve(img);
    };
    img.onerror = () => {
      assetPromises.delete(key);
      reject(new Error(`Failed to load asset: ${src}`));
    };
    img.src = src;
  });

  assetPromises.set(key, promise);
  return promise;
}

async function loadAssetsByKeys(keys: AssetKey[]): Promise<AssetMap> {
  if (keys.length === 0) return {};

  const loaded = await Promise.all(keys.map(async (key) => [key, await loadAsset(key)] as const));
  return loaded.reduce((acc, [key, img]) => {
    acc[key] = img;
    return acc;
  }, {} as AssetMap);
}

export function loadAssets(): Promise<AssetMap> {
  return loadAssetsForLevel("forest");
}

export async function loadAssetsForLevel(levelId: keyof typeof ASSET_GROUPS): Promise<AssetMap> {
  const cached = groupCache.get(levelId);
  if (cached) return cached;

  const keys = ASSET_GROUPS[levelId];
  const loaded = await loadAssetsByKeys(keys);
  groupCache.set(levelId, loaded);
  return loaded;
}

export function preloadAssetsForLevel(levelId: keyof typeof ASSET_GROUPS): void {
  void loadAssetsForLevel(levelId);
}

export function getAssets(): AssetMap {
  return Object.fromEntries(assetCache.entries()) as AssetMap;
}

export function getAsset(assets: AssetMap, key: AssetKey): HTMLImageElement | null {
  return assets[key] ?? assetCache.get(key) ?? null;
}

export const ANIMAL_ASSET_KEYS: AssetKey[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
];

export const ENVIRONMENT_ASSETS: AssetKey[] = ["tree", "treeBrown", "bush"];
