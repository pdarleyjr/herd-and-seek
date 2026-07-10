// Procedural renderer for the Savannah Reserve open-world zone.
// Original, stylized Canvas 2D art — no external assets. Drawn in ordered
// layers (sky → ground → trails → water → props → grass → herds → items →
// players → particles → lighting) with deterministic, culled decoration so
// nothing is regenerated every frame.
import {
  type OpenWorldZoneState,
  type CollectibleNode,
  DISTRICTS,
  OPEN_WORLD_WORLD_SIZE,
} from "./openWorldTypes";
import { drawAnimal, type Facing } from "./animalArt";

export type QualityTier = "high" | "balanced" | "battery";

export interface Particle {
  x: number;
  y: number;
  kind: "spark" | "text";
  text?: string;
  color?: string;
  age: number;
  ttl: number;
  vx: number;
  vy: number;
}

export interface Camera {
  camX: number;
  camY: number;
  width: number;
  height: number;
  scale: number;
}

export function worldToScreen(cam: Camera, wx: number, wy: number): [number, number] {
  return [
    (wx - cam.camX) * cam.scale + cam.width / 2,
    (wy - cam.camY) * cam.scale + cam.height / 2,
  ];
}

// ── Static terrain decoration (generated once, deterministic) ───────────────

interface Deco {
  x: number;
  y: number;
  kind: "grass" | "rock" | "bush" | "flower" | "log" | "mound" | "sign" | "twig";
  s: number;
  hue: number;
}

let DECOR: Deco[] | null = null;
function getDecor(): Deco[] {
  if (DECOR) return DECOR;
  let seed = 99173;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const kinds: Deco["kind"][] = ["grass", "grass", "grass", "rock", "bush", "flower", "log", "mound", "sign", "twig"];
  const list: Deco[] = [];
  for (let i = 0; i < 1400; i++) {
    list.push({
      x: rnd() * OPEN_WORLD_WORLD_SIZE,
      y: rnd() * OPEN_WORLD_WORLD_SIZE,
      kind: kinds[Math.floor(rnd() * kinds.length)],
      s: 0.7 + rnd() * 0.9,
      hue: rnd(),
    });
  }
  DECOR = list;
  return list;
}

// ── Ambient herds (distant, decorative) ─────────────────────────────────────

interface Herd {
  x: number;
  y: number;
  type: string;
}
let HERDS: Herd[] | null = null;
function getHerds(): Herd[] {
  if (HERDS) return HERDS;
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const types = ["zebra", "gazelle", "wildebeest", "meerkat"];
  const list: Herd[] = [];
  for (let i = 0; i < 60; i++) {
    list.push({ x: rnd() * OPEN_WORLD_WORLD_SIZE, y: rnd() * OPEN_WORLD_WORLD_SIZE, type: types[Math.floor(rnd() * types.length)] });
  }
  HERDS = list;
  return list;
}

// ── Districts ───────────────────────────────────────────────────────────────

function drawDistrict(ctx: CanvasRenderingContext2D, cam: Camera, id: string, cx: number, cy: number, time: number) {
  const [sx, sy] = worldToScreen(cam, cx, cy);
  if (sx < -400 || sx > cam.width + 400 || sy < -400 || sy > cam.height + 400) return;
  ctx.save();
  if (id === "wateringHole") {
    const r = 150 * cam.scale;
    const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r);
    g.addColorStop(0, "#3aa6d8");
    g.addColorStop(0.7, "#2170a8");
    g.addColorStop(1, "#13456e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(230,240,200,0.5)";
    ctx.lineWidth = 3 * cam.scale;
    for (let i = 0; i < 3; i++) {
      const p = ((time / 1400 + i / 3) % 1) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(sx + Math.cos(p) * r * 0.4, sy + Math.sin(p) * r * 0.3, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // shoreline
    ctx.strokeStyle = "#caa869";
    ctx.lineWidth = 6 * cam.scale;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r + 8 * cam.scale, r * 0.72 + 8 * cam.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === "lodge") {
    // Safe-zone ground
    ctx.fillStyle = "rgba(120,200,120,0.18)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 120 * cam.scale, 100 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // building
    ctx.fillStyle = "#6b4326";
    ctx.fillRect(sx - 70 * cam.scale, sy - 10 * cam.scale, 140 * cam.scale, 70 * cam.scale);
    ctx.fillStyle = "#4a2c16";
    ctx.beginPath();
    ctx.moveTo(sx - 84 * cam.scale, sy - 10 * cam.scale);
    ctx.lineTo(sx, sy - 64 * cam.scale);
    ctx.lineTo(sx + 84 * cam.scale, sy - 10 * cam.scale);
    ctx.closePath();
    ctx.fill();
    // porch
    ctx.fillStyle = "#8a5a32";
    ctx.fillRect(sx - 80 * cam.scale, sy + 56 * cam.scale, 160 * cam.scale, 14 * cam.scale);
    // door
    ctx.fillStyle = "#2a1808";
    ctx.fillRect(sx - 16 * cam.scale, sy + 6 * cam.scale, 32 * cam.scale, 50 * cam.scale);
    // sign
    ctx.fillStyle = "#f5d07a";
    ctx.fillRect(sx - 44 * cam.scale, sy - 84 * cam.scale, 88 * cam.scale, 20 * cam.scale);
    ctx.fillStyle = "#3a2410";
    ctx.font = `bold ${Math.max(10, 12 * cam.scale)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("RANGER OUTPOST", sx, sy - 70 * cam.scale);
    // lanterns
    for (const lx of [-60, 60]) {
      ctx.fillStyle = "#ffcf33";
      ctx.beginPath();
      ctx.arc(sx + lx * cam.scale, sy - 92 * cam.scale, 5 * cam.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // crates
    ctx.fillStyle = "#7a5a32";
    for (let i = 0; i < 3; i++) ctx.fillRect(sx + (i - 1) * 26 * cam.scale - 12 * cam.scale, sy + 72 * cam.scale, 24 * cam.scale, 20 * cam.scale);
  } else if (id === "acaciaGrove") {
    for (let i = 0; i < 5; i++) {
      const ox = ((i * 71) % 120) - 60;
      const oy = ((i * 53) % 90) - 45;
      drawAcacia(ctx, sx + ox * cam.scale, sy + oy * cam.scale, (0.8 + (i % 3) * 0.18) * cam.scale, time + i);
    }
  } else if (id === "ridgeTrail") {
    ctx.fillStyle = "rgba(150,110,70,0.5)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 160 * cam.scale, 80 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // rocky edges
    ctx.fillStyle = "#7a5a3a";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * 150 * cam.scale, sy + Math.sin(a) * 80 * cam.scale, 12 * cam.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // outlook marker
    ctx.fillStyle = "#caa869";
    ctx.beginPath();
    ctx.moveTo(sx, sy - 60 * cam.scale);
    ctx.lineTo(sx + 12 * cam.scale, sy - 36 * cam.scale);
    ctx.lineTo(sx - 12 * cam.scale, sy - 36 * cam.scale);
    ctx.closePath();
    ctx.fill();
  } else if (id === "grasslands") {
    ctx.fillStyle = "rgba(120,160,70,0.28)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 320 * cam.scale, 260 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    // distant landmark silhouettes
    ctx.fillStyle = "rgba(60,80,40,0.5)";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      drawAcacia(ctx, sx + Math.cos(a) * 220 * cam.scale, sy + Math.sin(a) * 170 * cam.scale, 0.6 * cam.scale, time + i);
    }
  }
  ctx.restore();
}

function drawAcacia(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, time: number) {
  const sway = Math.sin(time / 1600 + x) * 2 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#5a3a1a";
  ctx.lineWidth = 6 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(sway, -40 * scale);
  ctx.stroke();
  ctx.fillStyle = "#3a5a2a";
  ctx.beginPath();
  ctx.ellipse(sway, -52 * scale, 38 * scale, 16 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#466b33";
  ctx.beginPath();
  ctx.ellipse(sway - 10 * scale, -46 * scale, 22 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Collectibles ────────────────────────────────────────────────────────────

function drawCollectible(ctx: CanvasRenderingContext2D, x: number, y: number, node: CollectibleNode, time: number, near: boolean) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // glow when near
  if (near) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 200);
    ctx.fillStyle = `rgba(255,230,120,${0.25 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const bob = Math.sin(time / 350 + node.x) * 2;
  ctx.translate(0, bob);
  switch (node.kind) {
    case "coin":
      ctx.fillStyle = "#ffcf33";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff3b0";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("$", 0, 3);
      break;
    case "token":
      ctx.fillStyle = "#9b6cff";
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e0d0ff";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "supply":
      ctx.fillStyle = "#e0903a";
      ctx.fillRect(-10, -9, 20, 18);
      ctx.strokeStyle = "#5a3210";
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -9, 20, 18);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      break;
    case "track":
      ctx.fillStyle = "#6b4a2a";
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(-4 + i * 8, -3, 3.4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-4 + i * 8, 4, 3.4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}

// ── World render ────────────────────────────────────────────────────────────

export interface RenderOptions {
  time: number;
  localId: string;
  quality: QualityTier;
  particles: Particle[];
  reducedMotion?: boolean;
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  zone: OpenWorldZoneState,
  opts: RenderOptions,
): void {
  const { time, localId, quality, particles, reducedMotion } = opts;
  const W = cam.width;
  const H = cam.height;

  // 1. Sky / atmospheric gradient (screen space).
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#f6b65c");
  sky.addColorStop(0.35, "#e89a55");
  sky.addColorStop(0.7, "#9c6f86");
  sky.addColorStop(1, "#5a4a78");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 2. Ground base.
  ctx.fillStyle = "#caa869";
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.78, H * 0.12, 10, W * 0.78, H * 0.12, Math.max(W, H) * 0.6);
  sun.addColorStop(0, "rgba(255,220,140,0.35)");
  sun.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // 3. Terrain zones + trails.
  for (const d of DISTRICTS) drawDistrict(ctx, cam, d.id, d.cx, d.cy, reducedMotion ? 0 : time);
  ctx.strokeStyle = "rgba(110,80,50,0.5)";
  ctx.lineWidth = 10 * cam.scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...worldToScreen(cam, 1500, 1500));
  ctx.lineTo(...worldToScreen(cam, 650, 1500));
  ctx.lineTo(...worldToScreen(cam, 2300, 820));
  ctx.lineTo(...worldToScreen(cam, 2300, 2250));
  ctx.lineTo(...worldToScreen(cam, 1500, 1500));
  ctx.stroke();

  // 4/5. Static props (culled).
  const grassDensity = quality === "high" ? 1 : quality === "balanced" ? 0.6 : 0.35;
  for (const d of getDecor()) {
    if (d.kind === "grass" && Math.random() > grassDensity) continue;
    const [sx, sy] = worldToScreen(cam, d.x, d.y);
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
    drawDeco(ctx, sx, sy, d, cam.scale, reducedMotion ? 0 : time);
  }

  // 6. Foreground grass near camera.
  // 7. Ambient herds.
  const herdCount = quality === "high" ? getHerds().length : Math.min(24, getHerds().length);
  for (let i = 0; i < herdCount; i++) {
    const h = getHerds()[i];
    const [sx, sy] = worldToScreen(cam, h.x, h.y);
    if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
    drawAnimal(ctx, sx, sy, 22 * cam.scale, h.type, 1, reducedMotion ? 0 : time / 2, 0, false);
  }

  // 8. Collectibles.
  for (const n of zone.collectibles) {
    const [sx, sy] = worldToScreen(cam, n.x, n.y);
    if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
    const me = zone.players.find((p) => p.id === localId);
    const near = me ? Math.hypot(me.x - n.x, me.y - n.y) < 90 : false;
    drawCollectible(ctx, sx, sy, n, reducedMotion ? 0 : time, near);
  }

  // 9. Players (with nameplate collision avoidance).
  const labels: { sx: number; sy: number; text: string; local: boolean; facing: Facing }[] = [];
  for (const p of zone.players) {
    const [sx, sy] = worldToScreen(cam, p.x, p.y);
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
    const facing: Facing = p.id === localId ? 1 : 1;
    drawAnimal(ctx, sx, sy, 34 * cam.scale, p.animalType, facing, reducedMotion ? 0 : time / 2, reducedMotion ? 0 : time / 240, p.id === localId);
    labels.push({ sx, sy: sy - 30 * cam.scale, text: p.username, local: p.id === localId, facing });
  }
  // vertical stack to avoid overlap
  labels.sort((a, b) => a.sy - b.sy);
  for (let i = 1; i < labels.length; i++) {
    if (Math.abs(labels[i].sx - labels[i - 1].sx) < 60 && labels[i].sy - labels[i - 1].sy < 16) {
      labels[i].sy = labels[i - 1].sy - 16;
    }
  }
  for (const l of labels) {
    ctx.font = `bold ${Math.max(11, 12 * cam.scale)}px system-ui`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(l.text, l.sx, l.sy);
    ctx.fillStyle = l.local ? "#7fff00" : "#ffffff";
    ctx.fillText(l.text, l.sx, l.sy);
  }

  // 10. Particles + floating text.
  for (const p of particles) {
    const [sx, sy] = worldToScreen(cam, p.x, p.y);
    const life = 1 - p.age / p.ttl;
    if (p.kind === "spark") {
      ctx.fillStyle = `rgba(255,230,140,${life})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 * life + 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.font = `bold ${Math.max(13, 14 * cam.scale)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,207,51,${life})`;
      ctx.fillText(p.text ?? "", sx, sy);
    }
  }

  // 11. Vignette.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(20,10,5,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawDeco(ctx: CanvasRenderingContext2D, x: number, y: number, d: Deco, scale: number, time: number) {
  const s = d.s * scale;
  switch (d.kind) {
    case "grass": {
      const sway = Math.sin(time / 600 + x) * 2;
      ctx.strokeStyle = d.hue > 0.5 ? "#7faa3a" : "#6b9430";
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 3, y);
        ctx.quadraticCurveTo(x + i * 3 + sway, y - 8 * s, x + i * 3 + sway * 2, y - 14 * s);
        ctx.stroke();
      }
      break;
    }
    case "rock":
      ctx.fillStyle = "#9a9088";
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "bush":
      ctx.fillStyle = "#4f7a2e";
      ctx.beginPath();
      ctx.arc(x, y, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "flower":
      ctx.fillStyle = d.hue > 0.5 ? "#ffd84d" : "#ff9aa2";
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "log":
      ctx.fillStyle = "#6b4a2a";
      ctx.fillRect(x - 12 * s, y - 3 * s, 24 * s, 6 * s);
      break;
    case "mound":
      ctx.fillStyle = "#b08a4a";
      ctx.beginPath();
      ctx.ellipse(x, y, 14 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7a5a32";
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y - 6 * s);
      ctx.lineTo(x - 2 * s, y - 12 * s);
      ctx.moveTo(x + 6 * s, y - 6 * s);
      ctx.lineTo(x + 2 * s, y - 12 * s);
      ctx.stroke();
      break;
    case "sign":
      ctx.fillStyle = "#7a5a32";
      ctx.fillRect(x - 1.5 * s, y - 12 * s, 3 * s, 14 * s);
      ctx.fillStyle = "#caa869";
      ctx.fillRect(x - 9 * s, y - 12 * s, 18 * s, 8 * s);
      break;
    case "twig":
      ctx.strokeStyle = "#6b4a2a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y);
      ctx.lineTo(x + 6 * s, y - 3 * s);
      ctx.stroke();
      break;
  }
}

// ── Minimap ──────────────────────────────────────────────────────────────────

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  zone: OpenWorldZoneState,
  localId: string,
): void {
  ctx.save();
  // framed surface
  ctx.fillStyle = "rgba(18,26,14,0.82)";
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = "#7fff00";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 13);
  ctx.stroke();

  const pad = 10;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const map = (wx: number, wy: number): [number, number] => [ix + (wx / OPEN_WORLD_WORLD_SIZE) * iw, iy + (wy / OPEN_WORLD_WORLD_SIZE) * ih];

  // clip to inner area
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, 8);
  ctx.clip();
  ctx.fillStyle = "#caa869";
  ctx.fillRect(ix, iy, iw, ih);

  // district tints
  const tints: Record<string, string> = {
    lodge: "rgba(120,200,120,0.5)",
    grasslands: "rgba(120,160,70,0.5)",
    wateringHole: "rgba(40,120,180,0.6)",
    ridgeTrail: "rgba(150,110,70,0.6)",
    acaciaGrove: "rgba(60,90,40,0.7)",
  };
  for (const d of DISTRICTS) {
    const [mx, my] = map(d.cx, d.cy);
    ctx.fillStyle = tints[d.id] ?? "rgba(150,150,90,0.4)";
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // collectibles (few, relevant)
  ctx.fillStyle = "#ffcf33";
  for (const n of zone.collectibles.slice(0, 40)) {
    const [mx, my] = map(n.x, n.y);
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }

  // players
  for (const p of zone.players) {
    const [mx, my] = map(p.x, p.y);
    ctx.fillStyle = p.id === localId ? "#7fff00" : "#ff6b6b";
    ctx.beginPath();
    ctx.arc(mx, my, p.id === localId ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // North indicator
  ctx.fillStyle = "#f5d07a";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("N", x + w / 2, y + 12);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
