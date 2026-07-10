import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadAssetsForLevel,
  drawSprite,
  getSprite,
  getAsset,
  FOREST_ASSET_KEYS,
  type AssetKey,
  type AssetMap,
} from "./AssetLoader";
import { ATLAS_MANIFEST, ATLAS_FRAMES_2X } from "./generated/assetAtlasManifest";

// Minimal fake Image so atlas loading works under jsdom (no network). It fires
// `onload` synchronously whenever `src` is assigned; callers always set their
// onload handler before assigning src, mirroring real <img> usage.
class FakeImage {
  static instances = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 64;
  height = 64;
  private _src = "";
  constructor() {
    FakeImage.instances++;
  }
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    this.onload?.();
  }
  decode() {
    return Promise.resolve();
  }
}

describe("asset atlas manifest", () => {
  it("contains every forest AssetKey", () => {
    for (const key of FOREST_ASSET_KEYS) {
      expect(ATLAS_MANIFEST.frames[key], `missing frame for ${key}`).toBeDefined();
    }
    expect(Object.keys(ATLAS_MANIFEST.frames).length).toBe(FOREST_ASSET_KEYS.length);
  });

  it("defines 1x and 2x atlases", () => {
    expect(ATLAS_MANIFEST.atlases.find((a) => a.scale === 1)).toBeDefined();
    expect(ATLAS_MANIFEST.atlases.find((a) => a.scale === 2)).toBeDefined();
    expect(Object.keys(ATLAS_FRAMES_2X).length).toBe(FOREST_ASSET_KEYS.length);
  });

  it("atlas dimensions stay within the 2048 mobile-safe maximum", () => {
    for (const a of ATLAS_MANIFEST.atlases) {
      expect(a.width).toBeLessThanOrEqual(2048);
      expect(a.height).toBeLessThanOrEqual(2048);
    }
  });
});

describe("loadAssetsForLevel", () => {
  beforeEach(() => {
    globalThis.Image = FakeImage as unknown as typeof Image;
    FakeImage.instances = 0;
  });
  afterEach(() => {
    delete globalThis.Image;
  });

  it("loads atlas-backed assets for forest", async () => {
    const assets = await loadAssetsForLevel("forest");
    const rabbit = getSprite(assets as AssetMap, "rabbit");
    expect(rabbit).not.toBeNull();
    expect(rabbit?.frame.w).toBeGreaterThan(0);
    expect(rabbit?.image).toBeDefined();
  });

  it("does NOT load any forest PNGs for deepDark", async () => {
    const assets = await loadAssetsForLevel("deepDark");
    expect(Object.keys(assets)).toHaveLength(0);
    expect(FakeImage.instances).toBe(0);
  });

  it("does NOT load any forest PNGs for savannah", async () => {
    const assets = await loadAssetsForLevel("savannah");
    expect(Object.keys(assets)).toHaveLength(0);
    expect(FakeImage.instances).toBe(0);
  });
});

describe("drawSprite", () => {
  const fakeCtx = () =>
    ({
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      globalAlpha: 1,
    }) as unknown as CanvasRenderingContext2D;

  it("returns false for a missing key without throwing", () => {
    const drawn = drawSprite(fakeCtx(), {} as AssetMap, "does_not_exist" as AssetKey, 10, 10, 32, 32);
    expect(drawn).toBe(false);
  });

  it("draws an atlas sprite and returns true", () => {
    const assets: AssetMap = {
      rabbit: {
        key: "rabbit",
        image: new FakeImage() as unknown as HTMLImageElement,
        frame: { key: "rabbit", atlasId: "forest@1x", x: 0, y: 0, w: 40, h: 40, sourceW: 40, sourceH: 40, offsetX: 0, offsetY: 0, scale: 1 },
      },
    };
    const ctx = fakeCtx();
    const spy = vi.spyOn(ctx, "drawImage");
    const drawn = drawSprite(ctx, assets, "rabbit", 10, 10, 32, 32, { flipX: true });
    expect(drawn).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it("getAsset returns the bitmap for existence checks", () => {
    const rabbit = new FakeImage() as unknown as HTMLImageElement;
    const assets: AssetMap = {
      rabbit: { key: "rabbit", image: rabbit, frame: { key: "rabbit", atlasId: "forest@1x", x: 0, y: 0, w: 40, h: 40, sourceW: 40, sourceH: 40, offsetX: 0, offsetY: 0, scale: 1 } },
    };
    expect(getAsset(assets, "rabbit")).toBe(rabbit);
    expect(getAsset(assets, "tree" as AssetKey)).toBeNull();
  });
});
