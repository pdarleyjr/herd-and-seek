export type AssetKey =
  | "hunter"
  | "survivor"
  | "elephant"
  | "penguin"
  | "monkey"
  | "giraffe"
  | "tree"
  | "treeBrown"
  | "bush";

export type AssetMap = Record<AssetKey, HTMLImageElement>;

const ASSET_PATHS: Record<AssetKey, string> = {
  hunter: "/assets/hunter.png",
  survivor: "/assets/survivor.png",
  elephant: "/assets/elephant.png",
  penguin: "/assets/penguin.png",
  monkey: "/assets/monkey.png",
  giraffe: "/assets/giraffe.png",
  tree: "/assets/tree.png",
  treeBrown: "/assets/treeBrown.png",
  bush: "/assets/bush.png",
};

let cachedAssets: AssetMap | null = null;

export function loadAssets(): Promise<AssetMap> {
  if (cachedAssets) return Promise.resolve(cachedAssets);

  const entries = Object.entries(ASSET_PATHS) as [AssetKey, string][];
  const promises = entries.map(([key, src]) => {
    return new Promise<[AssetKey, HTMLImageElement]>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve([key, img]);
      img.onerror = () =>
        reject(new Error(`Failed to load asset: ${src}`));
      img.src = src;
    });
  });

  return Promise.all(promises).then((results) => {
    cachedAssets = results.reduce((acc, [key, img]) => {
      acc[key] = img;
      return acc;
    }, {} as Partial<AssetMap>) as AssetMap;
    return cachedAssets;
  });
}

export function getAssets(): AssetMap {
  if (!cachedAssets) {
    throw new Error("Assets not loaded. Call loadAssets() first.");
  }
  return cachedAssets;
}

export const ANIMAL_ASSETS: AssetKey[] = [
  "elephant",
  "penguin",
  "monkey",
  "giraffe",
];

export const ENVIRONMENT_ASSETS: AssetKey[] = ["tree", "treeBrown", "bush"];
