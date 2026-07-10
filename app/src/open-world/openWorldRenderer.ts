// Procedural renderer for the Savannah Reserve open-world zone. No bitmap assets
// are used for this mode — everything is drawn from primitives so it stays
// lightweight and works on every device.
import {
  type OpenWorldZoneState,
  type CollectibleNode,
  DISTRICTS,
  OPEN_WORLD_WORLD_SIZE,
} from "./openWorldTypes";
import { QUEST_CATALOG } from "./questCatalog";

export interface Camera {
  // World coordinate currently centered in the viewport.
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

const ANIMAL_COLORS: Record<string, string> = {
  zebra: "#e8e6df",
  gazelle: "#c99a5b",
  wildebeest: "#5c534a",
  warthog: "#7a5a3a",
  ostrich: "#3a3230",
  meerkat: "#b89a6a",
  hyena: "#9a8560",
  secretarybird: "#c8c2b4",
  rabbit: "#d9c9b0",
  bear: "#6b4a2a",
  owl: "#8a7a5a",
  snake: "#3f8a3a",
  frog: "#4cae4c",
  duck: "#5a6b5a",
  dog: "#b07a3a",
  panda: "#e8e8e8",
  elephant: "#b0b0b0",
  penguin: "#2a2a2a",
  monkey: "#7a5a3a",
  giraffe: "#d8b040",
  horse: "#8a5a2a",
  pig: "#e090a0",
  cow: "#d8d8d0",
  parrot: "#3aa0d0",
};

function drawAnimalGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, animalType: string, highlight: boolean) {
  const color = ANIMAL_COLORS[animalType] ?? "#8a7a5a";
  ctx.save();
  ctx.translate(x, y);
  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.arc(size * 0.42, -size * 0.12, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.arc(size * 0.34, -size * 0.3, size * 0.08, 0, Math.PI * 2);
  ctx.arc(size * 0.5, -size * 0.3, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  if (highlight) {
    ctx.strokeStyle = "#7fff00";
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCollectible(ctx: CanvasRenderingContext2D, x: number, y: number, node: CollectibleNode) {
  ctx.save();
  ctx.translate(x, y);
  const r = 9;
  switch (node.kind) {
    case "coin":
      ctx.fillStyle = "#ffcf33";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.stroke();
      break;
    case "token":
      ctx.fillStyle = "#9b6cff";
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case "supply":
      ctx.fillStyle = "#e0903a";
      ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      ctx.strokeStyle = "#5a3210";
      ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      break;
    case "track":
      ctx.strokeStyle = "#6b4a2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawDistrict(ctx: CanvasRenderingContext2D, cam: Camera, id: string, cx: number, cy: number) {
  const [sx, sy] = worldToScreen(cam, cx, cy);
  ctx.save();
  if (id === "wateringHole") {
    ctx.fillStyle = "rgba(40,120,180,0.55)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 110 * cam.scale, 80 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "lodge") {
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(sx - 26, sy - 18, 52, 36);
    ctx.fillStyle = "#5a3210";
    ctx.beginPath();
    ctx.moveTo(sx - 32, sy - 18);
    ctx.lineTo(sx, sy - 40);
    ctx.lineTo(sx + 32, sy - 18);
    ctx.closePath();
    ctx.fill();
  } else if (id === "acaciaGrove") {
    ctx.fillStyle = "#3a5a2a";
    for (let i = 0; i < 4; i++) {
      const ox = ((i * 53) % 90) - 45;
      const oy = ((i * 37) % 70) - 35;
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy - 10, 18 * cam.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b4a2a";
      ctx.fillRect(sx + ox - 2, sy + oy, 4, 18);
      ctx.fillStyle = "#3a5a2a";
    }
  } else if (id === "ridgeTrail") {
    ctx.fillStyle = "rgba(150,120,80,0.6)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 140 * cam.scale, 60 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "grasslands") {
    ctx.fillStyle = "rgba(120,160,70,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 320 * cam.scale, 260 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  zone: OpenWorldZoneState,
  localPlayerId: string,
  time: number,
) {
  // Ground base.
  ctx.fillStyle = "#caa869";
  ctx.fillRect(0, 0, cam.width, cam.height);

  // Subtle grass texture stripes (deterministic, cheap).
  ctx.strokeStyle = "rgba(150,170,90,0.25)";
  ctx.lineWidth = 1;
  const step = 64 * cam.scale;
  for (let gx = -((cam.camX * cam.scale) % step) - step; gx < cam.width; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, cam.height);
    ctx.stroke();
  }

  // Districts.
  for (const d of DISTRICTS) drawDistrict(ctx, cam, d.id, d.cx, d.cy);

  // Ambient herd NPC clusters (deterministic pseudo-positions).
  ctx.globalAlpha = 0.85;
  let seed = 1337;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const ambientTypes = ["zebra", "gazelle", "wildebeest", "meerkat"];
  for (let i = 0; i < 26; i++) {
    const ax = rng() * OPEN_WORLD_WORLD_SIZE;
    const ay = rng() * OPEN_WORLD_WORLD_SIZE;
    const [sx, sy] = worldToScreen(cam, ax, ay);
    if (sx < -40 || sx > cam.width + 40 || sy < -40 || sy > cam.height + 40) continue;
    drawAnimalGlyph(ctx, sx, sy, 22 * cam.scale, ambientTypes[i % ambientTypes.length], false);
  }
  ctx.globalAlpha = 1;

  // Collectible nodes.
  for (const n of zone.collectibles) {
    const [sx, sy] = worldToScreen(cam, n.x, n.y);
    if (sx < -20 || sx > cam.width + 20 || sy < -20 || sy > cam.height + 20) continue;
    drawCollectible(ctx, sx, sy, n);
  }

  // Players.
  for (const p of zone.players) {
    const [sx, sy] = worldToScreen(cam, p.x, p.y);
    if (sx < -40 || sx > cam.width + 40 || sy < -40 || sy > cam.height + 40) continue;
    drawAnimalGlyph(ctx, sx, sy, 28 * cam.scale, p.animalType, p.id === localPlayerId);
    ctx.fillStyle = p.id === localPlayerId ? "#7fff00" : "#ffffff";
    ctx.font = `${Math.max(10, 12 * cam.scale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(p.username, sx, sy - 22 * cam.scale);
  }

  // Quest markers: pulse near incomplete targets using collected/known quests.
  const pulse = 0.5 + 0.5 * Math.sin(time / 400);
  for (const q of QUEST_CATALOG) {
    const marker = DISTRICTS.find((d) => d.id === "lodge");
    if (!marker) continue;
    const [sx, sy] = worldToScreen(cam, marker.cx, marker.cy - 70);
    ctx.globalAlpha = 0.4 + 0.4 * pulse;
    ctx.fillStyle = q.daily ? "#ffd84d" : "#4dd2ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 6 * cam.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  zone: OpenWorldZoneState,
  localPlayerId: string,
) {
  ctx.save();
  ctx.fillStyle = "rgba(20,30,15,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#7fff00";
  ctx.strokeRect(x, y, w, h);
  const map = (wx: number, wy: number): [number, number] => [
    x + (wx / OPEN_WORLD_WORLD_SIZE) * w,
    y + (wy / OPEN_WORLD_WORLD_SIZE) * h,
  ];
  // Districts.
  for (const d of DISTRICTS) {
    const [mx, my] = map(d.cx, d.cy);
    ctx.fillStyle = "rgba(200,200,120,0.6)";
    ctx.fillRect(mx - 3, my - 3, 6, 6);
  }
  // Collectibles (nearby only — show all for simplicity).
  ctx.fillStyle = "#ffcf33";
  for (const n of zone.collectibles.slice(0, 60)) {
    const [mx, my] = map(n.x, n.y);
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }
  // Players.
  for (const p of zone.players) {
    const [mx, my] = map(p.x, p.y);
    ctx.fillStyle = p.id === localPlayerId ? "#7fff00" : "#ff6b6b";
    ctx.beginPath();
    ctx.arc(mx, my, p.id === localPlayerId ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
