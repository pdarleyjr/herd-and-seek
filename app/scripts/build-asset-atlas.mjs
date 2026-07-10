// Build the forest sprite atlas: pack all source PNGs into 1x + 2x atlases
// (WebP + PNG fallback) and emit a TypeScript manifest + size report.
//
//   node scripts/build-asset-atlas.mjs           # build
//   node scripts/build-asset-atlas.mjs --check   # verify outputs only
//
// Deterministic: sprites are sorted by size, packed with a shelf algorithm,
// and composited in a stable order so re-running yields byte-identical frames.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "assets-src", "sprites", "forest");
const OUT_DIR = join(ROOT, "public", "generated-assets", "atlas");
const MANIFEST_OUT = join(ROOT, "src", "generated", "assetAtlasManifest.ts");

const MAX_DIM = 2048;
const PADDING = 2;
const CHECK_ONLY = process.argv.includes("--check");
const ALLOW_LARGER = process.argv.includes("--allow-larger");

/** @typedef {{ key: string, w: number, h: number, buf: Buffer }} SpriteSrc */

async function loadSprites() {
  const files = readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  /** @type {SpriteSrc[]} */
  const sprites = [];
  for (const f of files) {
    const key = basename(f, extname(f)); // AssetKey === filename without extension
    const buf = readFileSync(join(SRC_DIR, f));
    const meta = await sharp(buf).metadata();
    sprites.push({ key, w: meta.width || 0, h: meta.height || 0, buf });
  }
  // Deterministic order: by height desc, then width desc, then key.
  sprites.sort((a, b) => b.h - a.h || b.w - a.w || (a.key < b.key ? -1 : 1));
  return sprites;
}

// Shelf packer. Returns placed rects and total atlas dimensions for a given scale.
function pack(sprites, scale) {
  const scaled = sprites.map((s) => ({ key: s.key, w: s.w * scale, h: s.h * scale }));
  let x = PADDING;
  let y = PADDING;
  let shelfH = 0;
  let atlasW = 0;
  const placed = [];
  for (const s of scaled) {
    if (x + s.w + PADDING > MAX_DIM && x > PADDING) {
      y += shelfH + PADDING;
      x = PADDING;
      shelfH = 0;
    }
    placed.push({ key: s.key, x, y, w: s.w, h: s.h });
    x += s.w + PADDING;
    shelfH = Math.max(shelfH, s.h);
    atlasW = Math.max(atlasW, x);
  }
  const atlasH = y + shelfH + PADDING;
  return { placed, atlasW: Math.min(MAX_DIM, atlasW), atlasH };
}

async function buildAtlas(sprites, placed, atlasW, atlasH, scale, format) {
  let base = sharp({
    create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const composites = [];
  for (const p of placed) {
    const src = sprites.find((s) => s.key === p.key);
    let input = src.buf;
    if (scale !== 1) {
      input = await sharp(src.buf).resize(p.w, p.h, { kernel: "lanczos3" }).toBuffer();
    }
    composites.push({ input, left: p.x, top: p.y });
  }
  base = base.composite(composites);
  const buf =
    format === "webp"
      ? await base.webp({ quality: 90 }).toBuffer()
      : await base.png({ compressionLevel: 9 }).toBuffer();
  return buf;
}

function manifestEntry(placed, atlasId, scale) {
  const frames = {};
  for (const p of placed) {
    frames[p.key] = {
      key: p.key,
      atlasId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      sourceW: p.w,
      sourceH: p.h,
      offsetX: 0,
      offsetY: 0,
      scale,
    };
  }
  return frames;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(MANIFEST_OUT), { recursive: true });

  const sprites = await loadSprites();
  if (sprites.length === 0) throw new Error(`No source PNGs found in ${SRC_DIR}`);

  const pack1 = pack(sprites, 1);
  const pack2 = pack(sprites, 2);

  const existingWebp1 = join(OUT_DIR, "forest@1x.webp");
  const existingPng1 = join(OUT_DIR, "forest@1x.png");
  const existingWebp2 = join(OUT_DIR, "forest@2x.webp");
  const existingPng2 = join(OUT_DIR, "forest@2x.png");
  const haveOutputs =
    [existingWebp1, existingPng1, existingWebp2, existingPng2].every((f) => {
      try { return statSync(f).size > 0; } catch { return false; }
    });

  if (CHECK_ONLY) {
    if (!haveOutputs) throw new Error("Atlas outputs missing — run the build first.");
    console.log("✓ atlas outputs present");
  } else {
    const webp1 = await buildAtlas(sprites, pack1.placed, pack1.atlasW, pack1.atlasH, 1, "webp");
    const png1 = await buildAtlas(sprites, pack1.placed, pack1.atlasW, pack1.atlasH, 1, "png");
    const webp2 = await buildAtlas(sprites, pack2.placed, pack2.atlasW, pack2.atlasH, 2, "webp");
    const png2 = await buildAtlas(sprites, pack2.placed, pack2.atlasW, pack2.atlasH, 2, "png");
    writeFileSync(existingWebp1, webp1);
    writeFileSync(existingPng1, png1);
    writeFileSync(existingWebp2, webp2);
    writeFileSync(existingPng2, png2);
    console.log(`✓ wrote atlases (1x ${pack1.atlasW}x${pack1.atlasH}, 2x ${pack2.atlasW}x${pack2.atlasH})`);
  }

  const frames1 = manifestEntry(pack1.placed, "forest@1x", 1);
  const frames2 = manifestEntry(pack2.placed, "forest@2x", 2);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    atlases: [
      { id: "forest@1x", biome: "forest", scale: 1, webpUrl: "/generated-assets/atlas/forest@1x.webp", pngUrl: "/generated-assets/atlas/forest@1x.png", width: pack1.atlasW, height: pack1.atlasH },
      { id: "forest@2x", biome: "forest", scale: 2, webpUrl: "/generated-assets/atlas/forest@2x.webp", pngUrl: "/generated-assets/atlas/forest@2x.png", width: pack2.atlasW, height: pack2.atlasH },
    ],
    frames: frames1,
  };

  const manifestTs = `// AUTO-GENERATED by scripts/build-asset-atlas.mjs — do not edit by hand.
// Regenerate with: npm run assets:build
export type AtlasFormat = "webp" | "png";

export interface AtlasFrame {
  key: string;
  atlasId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceW: number;
  sourceH: number;
  offsetX: number;
  offsetY: number;
  scale: 1 | 2;
}

export interface AtlasImageDef {
  id: string;
  biome: "forest";
  scale: 1 | 2;
  webpUrl: string;
  pngUrl: string;
  width: number;
  height: number;
}

export interface AssetAtlasManifest {
  version: number;
  generatedAt: string;
  atlases: AtlasImageDef[];
  frames: Record<string, AtlasFrame>;
}

export const ATLAS_MANIFEST: AssetAtlasManifest = ${JSON.stringify(manifest, null, 2)};

// 2x frames (parallel map keyed by AssetKey). Picked at runtime when devicePixelRatio >= 2.
export const ATLAS_FRAMES_2X: Record<string, AtlasFrame> = ${JSON.stringify(frames2, null, 2)};
`;
  writeFileSync(MANIFEST_OUT, manifestTs);

  // Size report.
  const originalBytes = sprites.reduce((sum, s) => sum + s.buf.length, 0);
  const webpBytes = statSync(existingWebp1).size;
  const pngBytes = statSync(existingPng1).size;
  const report = {
    originalPngTotalBytes: originalBytes,
    atlas1xWebpBytes: webpBytes,
    atlas1xPngBytes: pngBytes,
    atlas2xWebpBytes: statSync(existingWebp2).size,
    atlasCount: sprites.length,
    webpSavingsPct: Math.round((1 - webpBytes / originalBytes) * 100),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, "asset-size-report.json"), JSON.stringify(report, null, 2));

  console.log(`✓ manifest written (${sprites.length} frames)`);
  console.log(`  original PNG total: ${originalBytes} B`);
  console.log(`  atlas 1x webp:      ${webpBytes} B (${report.webpSavingsPct}% smaller)`);
  console.log(`  atlas 1x png:       ${pngBytes} B`);

  // ── Performance budget checks ──
  const missing = sprites.filter((s) => !frames1[s.key]);
  if (missing.length) throw new Error(`Manifest missing frames: ${missing.map((m) => m.key).join(", ")}`);
  for (const a of manifest.atlases) {
    if (a.width > MAX_DIM || a.height > MAX_DIM) {
      throw new Error(`Atlas ${a.id} exceeds ${MAX_DIM}x${MAX_DIM} (${a.width}x${a.height})`);
    }
  }
  if (!ALLOW_LARGER && webpBytes >= originalBytes) {
    throw new Error(
      `Generated WebP (${webpBytes}B) is not smaller than original PNG total (${originalBytes}B). ` +
        `Re-tune compression or pass --allow-larger.`,
    );
  }
  console.log("✓ performance budget checks passed");
}

main().catch((err) => {
  console.error("Atlas build failed:", err.message);
  process.exit(1);
});
