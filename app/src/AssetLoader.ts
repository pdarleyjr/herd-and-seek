import {
  ATLAS_MANIFEST,
  ATLAS_FRAMES_2X,
  type AtlasFrame,
  type AssetAtlasManifest,
} from "./generated/assetAtlasManifest";

export type AssetKey =
  | "hunter" | "survivor"
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake"
  | "tree" | "treeBrown" | "bush";

// A loaded sprite backed by an atlas (image + sub-rect frame).
export type SpriteAsset = {
  key: AssetKey;
  image: HTMLImageElement | ImageBitmap;
  frame: AtlasFrame;
};

export type AssetMap = Partial<Record<AssetKey, SpriteAsset>>;

// Original PNGs are retained for a runtime fallback path if the atlas fails to
// decode (e.g. ancient browser). Only forest uses bitmap art; ocean & savannah
// are procedural and load no PNGs.
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

export const FOREST_ASSET_KEYS: AssetKey[] = Object.keys(ASSET_PATHS) as AssetKey[];

export type BiomeId = "forest" | "deepDark" | "savannah";

export const BIOME_MANIFEST: Record<BiomeId, { keys: readonly AssetKey[]; procedural: boolean }> = {
  forest: { keys: FOREST_ASSET_KEYS, procedural: false },
  deepDark: { keys: [], procedural: true },
  savannah: { keys: [], procedural: true },
};

const groupCache = new Map<BiomeId, AssetMap>();

// ── Atlas loading (preferred) ─────────────────────────────────────────────────
let _supportsWebp: boolean | null = null;
function supportsWebp(): boolean {
  if (_supportsWebp !== null) return _supportsWebp;
  try {
    _supportsWebp = typeof document !== "undefined"
      && document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch {
    _supportsWebp = false;
  }
  return _supportsWebp;
}

function loadAtlasImage(def: AssetAtlasManifest["atlases"][number]): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tryUrl = (url: string, isFallback: boolean) => {
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (!isFallback && def.pngUrl !== url) {
          // WebP failed — fall back to PNG atlas.
          img.onerror = () => reject(new Error("atlas decode failed"));
          img.src = def.pngUrl;
        } else {
          reject(new Error("atlas decode failed"));
        }
      };
      img.src = url;
    };
    tryUrl(supportsWebp() ? def.webpUrl : def.pngUrl, false);
  });
}

function pickScale(): 1 | 2 {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return dpr >= 2 ? 2 : 1;
}

async function loadForestAtlas(): Promise<AssetMap> {
  const scale = pickScale();
  const def = ATLAS_MANIFEST.atlases.find((a) => a.scale === scale) ?? ATLAS_MANIFEST.atlases[0];
  const frames = scale === 2 ? ATLAS_FRAMES_2X : ATLAS_MANIFEST.frames;
  const image = await loadAtlasImage(def);
  const map: AssetMap = {};
  for (const key of Object.keys(frames)) {
    if (key in ASSET_PATHS) {
      map[key as AssetKey] = { key: key as AssetKey, image, frame: frames[key] };
    }
  }
  return map;
}

// Fallback: load each original PNG individually and synthesize a full-frame.
const fallbackCache = new Map<AssetKey, Promise<HTMLImageElement>>();
function loadSingle(key: AssetKey): Promise<HTMLImageElement> {
  const cached = fallbackCache.get(key);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load asset: ${key}`));
    img.src = ASSET_PATHS[key];
  });
  fallbackCache.set(key, p);
  return p;
}

async function loadForestFallback(): Promise<AssetMap> {
  const map: AssetMap = {};
  await Promise.all(
    FOREST_ASSET_KEYS.map(async (key) => {
      try {
        const img = await loadSingle(key);
        map[key] = {
          key,
          image: img,
          frame: { key, atlasId: "fallback", x: 0, y: 0, w: img.width, h: img.height, sourceW: img.width, sourceH: img.height, offsetX: 0, offsetY: 0, scale: 1 },
        };
      } catch {
        /* skip missing */
      }
    }),
  );
  return map;
}

export function loadAssets(): Promise<AssetMap> {
  return loadAssetsForLevel("forest");
}

export async function loadAssetsForLevel(levelId: BiomeId): Promise<AssetMap> {
  const cached = groupCache.get(levelId);
  if (cached) return cached;

  // Procedural biomes load no bitmap assets at all.
  if (levelId !== "forest") {
    const empty: AssetMap = {};
    groupCache.set(levelId, empty);
    return empty;
  }

  let map: AssetMap;
  try {
    map = await loadForestAtlas();
  } catch {
    map = await loadForestFallback();
  }
  groupCache.set(levelId, map);
  return map;
}

export function preloadAssetsForLevel(levelId: BiomeId): void {
  void loadAssetsForLevel(levelId);
}

// ── Accessors ─────────────────────────────────────────────────────────────────
export function getSprite(assets: AssetMap, key: AssetKey): SpriteAsset | null {
  return assets[key] ?? null;
}

// Returns the underlying bitmap for existence checks / legacy usage.
export function getAsset(assets: AssetMap, key: AssetKey): HTMLImageElement | ImageBitmap | null {
  return assets[key]?.image ?? null;
}

export function getAssets(): AssetMap {
  const all: AssetMap = {};
  for (const m of groupCache.values()) Object.assign(all, m);
  return all;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
// Draws a sprite from its atlas sub-rect, centered at (cx, cy). Returns false
// when the sprite is missing so callers can fall back to procedural drawing.
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  assets: AssetMap,
  key: AssetKey,
  cx: number,
  cy: number,
  dw: number,
  dh: number,
  options?: { rotation?: number; alpha?: number; flipX?: boolean },
): boolean {
  const sp = getSprite(assets, key);
  if (!sp) return false;
  ctx.save();
  if (options?.alpha != null) ctx.globalAlpha = options.alpha;
  ctx.translate(cx, cy);
  if (options?.rotation) ctx.rotate(options.rotation);
  if (options?.flipX) ctx.scale(-1, 1);
  ctx.drawImage(sp.image, sp.frame.x, sp.frame.y, sp.frame.w, sp.frame.h, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}

export const ANIMAL_ASSET_KEYS: AssetKey[] = FOREST_ASSET_KEYS.filter(
  (k) => k !== "tree" && k !== "treeBrown" && k !== "bush" && k !== "hunter" && k !== "survivor",
);

export const ENVIRONMENT_ASSETS: AssetKey[] = ["tree", "treeBrown", "bush"];
