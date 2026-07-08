// Procedural sprite + level rendering helpers for Herd & Seek.
// Ocean animals have no PNG assets, so they are drawn here in a rounded
// cartoon style consistent with the existing forest sprites.
import type { AnimalType, LevelId } from "../types";
import { WORLD_SIZE, ANIMAL_DEFS } from "../types";

// ── Shared PRNG (deterministic environment from a seed) ───────────────────
export function mulberry32(seed: number) {
  let a = (seed | 0) >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const OCEAN_ANIMALS_LIST: AnimalType[] = [
  "fish", "turtle", "crab", "octopus", "jellyfish", "shark", "seahorse", "stingray",
];

export function isOceanAnimal(type: AnimalType): boolean {
  return (ANIMAL_DEFS[type]?.ocean) ?? OCEAN_ANIMALS_LIST.includes(type);
}

export function animalColor(type: AnimalType): string {
  return ANIMAL_DEFS[type]?.color ?? "#888";
}

// ── Ocean animal procedural sprites (top-down, ~size px) ──────────────────
export function drawOceanAnimal(
  ctx: CanvasRenderingContext2D,
  type: AnimalType,
  x: number,
  y: number,
  size: number,
  vx: number = 0,
) {
  const facingLeft = vx < -0.1;
  ctx.save();
  ctx.translate(x, y);
  if (facingLeft) ctx.scale(-1, 1);
  const r = size / 2;

  switch (type) {
    case "fish": {
      // body
      ctx.fillStyle = animalColor(type);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(-r * 1.35, -r * 0.5);
      ctx.lineTo(-r * 1.35, r * 0.5);
      ctx.closePath();
      ctx.fill();
      // stripe
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, 0, r * 0.35, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(r * 0.45, -r * 0.08, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(r * 0.48, -r * 0.08, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "shark": {
      ctx.fillStyle = animalColor(type);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // dorsal
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.45);
      ctx.lineTo(-r * 0.3, -r * 0.95);
      ctx.lineTo(r * 0.15, -r * 0.45);
      ctx.closePath();
      ctx.fill();
      // tail
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, 0);
      ctx.lineTo(-r * 1.45, -r * 0.55);
      ctx.lineTo(-r * 1.45, r * 0.55);
      ctx.closePath();
      ctx.fill();
      // belly
      ctx.fillStyle = "rgba(240,248,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.05, r * 0.22, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye + teeth
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(r * 0.6, -r * 0.06, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.75, r * 0.06);
      ctx.lineTo(r * 0.55, r * 0.14);
      ctx.stroke();
      break;
    }
    case "turtle": {
      // shell
      ctx.fillStyle = animalColor(type);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      // shell pattern
      ctx.strokeStyle = "rgba(20,60,20,0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0);
      ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
      ctx.stroke();
      // flippers
      ctx.fillStyle = "#2f7a3a";
      for (const [fx, fy] of [[r*0.7,-r*0.5],[r*0.7,r*0.5],[-r*0.7,-r*0.5],[-r*0.7,r*0.5]]) {
        ctx.beginPath();
        ctx.ellipse(fx, fy, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // head
      ctx.beginPath();
      ctx.arc(r * 1.0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(r * 1.05, -r * 0.06, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "crab": {
      ctx.fillStyle = animalColor(type);
      // body
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.7, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // legs (sideways scuttle)
      ctx.strokeStyle = animalColor(type);
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const ya = (i - 1) * r * 0.32;
          ctx.beginPath();
          ctx.moveTo(s * r * 0.6, ya);
          ctx.lineTo(s * r * 1.2, ya + s * 0 + (i % 2 ? r*0.15 : -r*0.1));
          ctx.stroke();
        }
        // claws
        ctx.beginPath();
        ctx.arc(s * r * 1.15, -r * 0.45, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      // eyes on stalks
      ctx.strokeStyle = animalColor(type);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.45); ctx.lineTo(-r * 0.1, -r * 0.8);
      ctx.moveTo(0, -r * 0.45); ctx.lineTo(r * 0.1, -r * 0.8);
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.8, r * 0.07, 0, Math.PI * 2);
      ctx.arc(r * 0.1, -r * 0.8, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "octopus": {
      ctx.fillStyle = animalColor(type);
      // head
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.8, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      // tentacles
      for (let i = 0; i < 8; i++) {
        const ang = Math.PI * (i / 7);
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.5, r * 0.2);
        ctx.quadraticCurveTo(
          Math.cos(ang) * r * 0.9, r * 0.6,
          Math.cos(ang) * r * 0.7 + (i % 2 ? r*0.2 : -r*0.2), r * 1.05,
        );
        ctx.strokeStyle = animalColor(type);
        ctx.lineWidth = r * 0.16;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      // eyes
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.15, r * 0.13, 0, Math.PI * 2);
      ctx.arc(r * 0.25, -r * 0.15, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.15, r * 0.07, 0, Math.PI * 2);
      ctx.arc(r * 0.28, -r * 0.15, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "jellyfish": {
      const color = animalColor(type);
      // bell
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      // translucent inner
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.55, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      // tentacles
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        const tx = (i / 3) * r * 0.7;
        ctx.beginPath();
        ctx.moveTo(tx, -r * 0.1);
        ctx.quadraticCurveTo(tx + (i % 2 ? r*0.15 : -r*0.15), r * 0.5, tx, r * 0.95);
        ctx.stroke();
      }
      break;
    }
    case "seahorse": {
      ctx.fillStyle = animalColor(type);
      // curved body
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.2, r * 0.2);
      ctx.quadraticCurveTo(-r * 0.4, r * 0.6, -r * 0.1, r * 0.95);
      ctx.lineWidth = r * 0.4;
      ctx.strokeStyle = animalColor(type);
      ctx.lineCap = "round";
      ctx.stroke();
      // head
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.75, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(r * 0.6, -r * 0.78, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "stingray": {
      ctx.fillStyle = animalColor(type);
      // flat diamond body
      ctx.beginPath();
      ctx.moveTo(r * 1.0, 0);
      ctx.quadraticCurveTo(0, -r * 0.8, -r * 1.0, 0);
      ctx.quadraticCurveTo(0, r * 0.8, r * 1.0, 0);
      ctx.fill();
      // spots
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (const [sx, sy] of [[-r*0.2,-r*0.1],[r*0.1,r*0.1],[-r*0.3,r*0.15]]) {
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      // tail
      ctx.strokeStyle = animalColor(type);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, 0);
      ctx.lineTo(-r * 1.5, r * 0.1);
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(r * 0.45, -r * 0.1, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Generic fallback disc
      ctx.fillStyle = animalColor(type);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Scuba diver hunter (top-down, rotated by facingAngle) ─────────────────
// facingAngle: direction the diver faces (radians, 0 = +x). isMoving adds
// a trailing bubble stream. scale ≈ same radius as the land hunter sprite.
export function drawScubaHunter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingAngle: number,
  isMoving: boolean,
  size: number,
  bubbleTrailMs: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facingAngle + Math.PI / 2); // sprite drawn pointing up = forward
  const r = size / 2;

  // Shadow on the seafloor beneath
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.7, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bubbles behind tank while moving
  if (isMoving && bubbleTrailMs > 0) {
    const t = (bubbleTrailMs % 1200) / 1200;
    for (let i = 0; i < 4; i++) {
      const bx = -r * 0.25 + (i % 2 ? 3 : -2);
      const by = r * 0.7 + i * 6 + t * 10;
      ctx.fillStyle = `rgba(220,245,255,${0.35 - i * 0.07})`;
      ctx.beginPath();
      ctx.arc(bx, by, 2 + i * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fins (yellow), trailing behind = bottom of sprite
  ctx.fillStyle = "#f5c020";
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, r * 0.55);
  ctx.lineTo(-r * 0.85, r * 1.15);
  ctx.lineTo(-r * 0.1, r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.35, r * 0.55);
  ctx.lineTo(r * 0.85, r * 1.15);
  ctx.lineTo(r * 0.1, r * 0.7);
  ctx.closePath();
  ctx.fill();

  // Wetsuit body (blue/black)
  ctx.fillStyle = "#16324a";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.52, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // arms
  ctx.strokeStyle = "#16324a";
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 0.85, -r * 0.2);
  ctx.moveTo(r * 0.4, 0); ctx.lineTo(r * 0.85, -r * 0.2);
  ctx.stroke();

  // Scuba tank on back
  ctx.fillStyle = "#9aa6ad";
  ctx.beginPath();
  ctx.roundRect(-r * 0.22, r * 0.1, r * 0.44, r * 0.7, 6);
  ctx.fill();
  // strap
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.2); ctx.lineTo(r * 0.5, r * 0.35);
  ctx.stroke();

  // Head (face-down: dark wetsuit hood, mask strap visible)
  ctx.fillStyle = "#0c1a26";
  ctx.beginPath();
  ctx.arc(0, -r * 0.5, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Mask / strap band seen from top
  ctx.strokeStyle = "#2bd4e0";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.55, r * 0.34, r * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Snorkel/regulator hose
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.3, -r * 0.3);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.1, r * 0.4, r * 0.15);
  ctx.stroke();

  ctx.restore();
}

// ── Deep Dark environment model ────────────────────────────────────────────
export interface OceanObj {
  id: number;
  kind: "boat" | "barrel" | "kelp" | "seaweed" | "reef" | "current";
  x: number;
  y: number;
  size: number; // approx radius / half-extent
  rotation: number;
}

export interface OceanEnvironment {
  objects: OceanObj[];
  // Horizontal current lanes (their y centers cycle on screen for wave bands)
  currents: { y: number; dir: number; width: number }[];
}

export interface ForestEntityRefs {
  trees: { x: number; y: number; type: "green" | "brown" | "bush" }[];
  rocks: { x: number; y: number; rx: number; ry: number; rotation: number; colorIdx: number }[];
  grassPatches: {
    x: number; y: number; count: number; spread: number;
    tall: boolean; seed: number; withFlower: boolean;
  }[];
}

export function generateForestEnvironment(rand: () => number): ForestEntityRefs {
  const trees: ForestEntityRefs["trees"] = [];
  for (let i = 0; i < 85; i++) {
    const r = rand();
    const type = r < 0.45 ? "green" : r < 0.70 ? "brown" : "bush";
    trees.push({
      x: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
      type,
    });
  }
  const rocks: ForestEntityRefs["rocks"] = [];
  for (let i = 0; i < 45; i++) {
    const large = i < 12;
    rocks.push({
      x: Math.floor(rand() * (WORLD_SIZE - 240)) + 120,
      y: Math.floor(rand() * (WORLD_SIZE - 240)) + 120,
      rx: large ? 28 + rand() * 20 : 12 + rand() * 12,
      ry: large ? 18 + rand() * 12 : 7 + rand() * 9,
      rotation: rand() * Math.PI,
      colorIdx: Math.floor(rand() * 3),
    });
  }
  const grassPatches: ForestEntityRefs["grassPatches"] = [];
  for (let i = 0; i < 70; i++) {
    const tall = i < 30;
    grassPatches.push({
      x: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
      count: tall ? 7 + Math.floor(rand() * 5) : 4 + Math.floor(rand() * 4),
      spread: tall ? 22 + Math.floor(rand() * 22) : 14 + Math.floor(rand() * 16),
      tall,
      seed: Math.floor(rand() * 9999) + 1,
      withFlower: !tall && rand() < 0.35,
    });
  }
  return { trees, rocks, grassPatches };
}

export function generateOceanEnvironment(rand: () => number): OceanEnvironment {
  const objects: OceanObj[] = [];
  let id = 0;
  // Helper: find a position that avoids the listed existing object centers by
  // at least `minDist` world units. Tries up to 30 times before giving up.
  const placeAway = (
    minDist: number,
    avoid: { x: number; y: number; size: number }[],
    margin = 120
  ): { x: number; y: number } => {
    for (let t = 0; t < 30; t++) {
      const x = Math.floor(rand() * (WORLD_SIZE - margin * 2)) + margin;
      const y = Math.floor(rand() * (WORLD_SIZE - margin * 2)) + margin;
      const tooClose = avoid.some((o) => Math.hypot(o.x - x, o.y - y) < minDist + o.size);
      if (!tooClose) return { x, y };
    }
    return {
      x: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(rand() * (WORLD_SIZE - 200)) + 100,
    };
  };

  // Wooden boats — large landmarks, well-spread so they read as distinct cover.
  const boats = 6;
  const boatCenters: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i < boats; i++) {
    const size = 90 + rand() * 40;
    const p = placeAway(420, boatCenters, 240);
    objects.push({
      id: id++,
      kind: "boat",
      x: p.x,
      y: p.y,
      size,
      rotation: rand() * Math.PI * 2,
    });
    boatCenters.push({ x: p.x, y: p.y, size });
  }

  // Spread out the barrels so they read as individual cover pieces, not clumps.
  const barrels = 28;
  const barrelCenters: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i < barrels; i++) {
    const size = 24 + rand() * 8;
    // Keep barrels clear of boats (margin = boat extent + a little) and apart
    // from each other so the player sees them spread across the water.
    const avoid = [...boatCenters, ...barrelCenters];
    const p = placeAway(95, avoid, 120);
    objects.push({
      id: id++,
      kind: "barrel",
      x: p.x,
      y: p.y,
      size,
      rotation: rand() * Math.PI,
    });
    barrelCenters.push({ x: p.x, y: p.y, size });
  }

  // Reef/rock clusters — keep off boats & barrels.
  const reefCenters: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const size = 28 + rand() * 30;
    const avoid = [...boatCenters, ...barrelCenters, ...reefCenters];
    const p = placeAway(120, avoid, 120);
    objects.push({
      id: id++,
      kind: "reef",
      x: p.x,
      y: p.y,
      size,
      rotation: rand() * Math.PI,
    });
    reefCenters.push({ x: p.x, y: p.y, size });
  }

  // Kelp — primary hiding cover. NEVER on boats (the player's landmark) so the
  // kelp beds read as distinct from the wooden boats.
  for (let i = 0; i < 60; i++) {
    const p = placeAway(140, boatCenters, 100);
    objects.push({
      id: id++,
      kind: "kelp",
      x: p.x,
      y: p.y,
      size: 40 + rand() * 26,
      rotation: rand() * Math.PI * 2,
    });
  }

  // Seaweed — lower drift beds; also kept off boats so boats stay clean.
  for (let i = 0; i < 50; i++) {
    const p = placeAway(130, boatCenters, 100);
    objects.push({
      id: id++,
      kind: "seaweed",
      x: p.x,
      y: p.y,
      size: 30 + rand() * 18,
      rotation: rand() * Math.PI * 2,
    });
  }
  // Current lanes (horizontal bands across the map)
  const currents: OceanEnvironment["currents"] = [];
  for (let i = 0; i < 5; i++) {
    currents.push({
      y: (WORLD_SIZE / 5) * i + 120 + rand() * 80,
      dir: i % 2 === 0 ? 1 : -1,
      width: 70 + rand() * 40,
    });
  }
  return { objects, currents };
}

// ── Ocean foreground/background draw routines ──────────────────────────────

export function drawOceanBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  w: number,
  h: number,
  time: number,
): void {
  // Base dark water
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#06243b");
  g.addColorStop(1, "#0a3a52");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Mottled water patches (world-coord, deterministic)
  const PATCH = 170;
  const sx = Math.floor(camX / PATCH) * PATCH;
  const sy = Math.floor(camY / PATCH) * PATCH;
  for (let px = sx - PATCH; px < camX + w + PATCH; px += PATCH) {
    for (let py = sy - PATCH; py < camY + h + PATCH; py += PATCH) {
      const s = Math.abs((px * 7919 + py * 6271) & 0x7fffffff);
      if (s % 10 < 5) {
        ctx.fillStyle = s % 3 === 0 ? "rgba(10,70,110,0.10)" : "rgba(8,40,70,0.10)";
        ctx.beginPath();
        ctx.ellipse(
          px - camX + (s & (PATCH - 1)) * 0.4,
          py - camY + ((s >> 8) & (PATCH - 1)) * 0.4,
          60 + (s & 50), 40 + ((s >> 4) & 40),
          (s & 3) * 0.5, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // Wave / current lanes — animated horizontal bands drifting across screen
  for (let laneY = -((time * 0.02) % 160); laneY < h + 160; laneY += 160) {
    const worldY = laneY + camY;
    const wave = Math.sin((worldY + time * 0.03) * 0.01);
    ctx.strokeStyle = `rgba(120,200,240,${0.04 + wave * 0.03})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = -20; x < w + 20; x += 24) {
      const yo = Math.sin((x + camX) * 0.02 + time * 0.003) * 6;
      if (x === -20) ctx.moveTo(x, laneY + yo);
      else ctx.lineTo(x, laneY + yo);
    }
    ctx.stroke();
  }

  // Subtle grid for spatial reference
  ctx.strokeStyle = "rgba(120,200,255,0.05)";
  ctx.lineWidth = 1;
  const grid = 120;
  const startX = Math.floor(camX / grid) * grid;
  const startY = Math.floor(camY / grid) * grid;
  for (let x = startX; x < camX + w + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x - camX, 0); ctx.lineTo(x - camX, h); ctx.stroke();
  }
  for (let y = startY; y < camY + h + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y - camY); ctx.lineTo(w, y - camY); ctx.stroke();
  }
}

export function drawOceanObject(
  ctx: CanvasRenderingContext2D,
  obj: OceanObj,
  sx: number,
  sy: number,
  time: number,
): void {
  const { kind, size } = obj;
  switch (kind) {
    case "boat": {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(obj.rotation);
      // hull
      ctx.fillStyle = "#6b4422";
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.34);
      ctx.lineTo(size * 0.7, -size * 0.34);
      ctx.quadraticCurveTo(size * 1.1, 0, size * 0.7, size * 0.34);
      ctx.lineTo(-size, size * 0.34);
      ctx.closePath();
      ctx.fill();
      // plank lines
      ctx.strokeStyle = "rgba(40,24,8,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.6, -size * 0.34); ctx.lineTo(-size * 0.6, size * 0.34);
      ctx.moveTo(size * 0.2, -size * 0.34); ctx.lineTo(size * 0.2, size * 0.34);
      ctx.stroke();
      // mast
      ctx.strokeStyle = "#4a2f18";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.34); ctx.lineTo(0, -size * 0.34 - size * 0.5);
      ctx.stroke();
      // sail (drooped)
      ctx.fillStyle = "rgba(230,225,210,0.7)";
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.34);
      ctx.quadraticCurveTo(-size * 0.5, -size * 0.5, -size * 0.05, -size * 0.85);
      ctx.lineTo(0, -size * 0.34);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "barrel": {
      ctx.save();
      ctx.translate(sx, sy);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(2, size * 0.4, size * 0.6, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.fillStyle = "#8a5a2a";
      ctx.beginPath();
      ctx.roundRect(-size * 0.5, -size * 0.5, size, size, size * 0.25);
      ctx.fill();
      // bands
      ctx.strokeStyle = "#5a3a18";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, -size * 0.18); ctx.lineTo(size * 0.5, -size * 0.18);
      ctx.moveTo(-size * 0.5, size * 0.18); ctx.lineTo(size * 0.5, size * 0.18);
      ctx.stroke();
      // highlight
      ctx.fillStyle = "rgba(255,220,150,0.2)";
      ctx.beginPath();
      ctx.roundRect(-size * 0.4, -size * 0.45, size * 0.2, size * 0.9, 4);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "reef": {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = "#3a4a52";
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.7, obj.rotation, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#53706a";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      // coral bits
      ctx.fillStyle = "#d05a6a";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-size * 0.2 + i * size * 0.2, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "kelp": {
      // Tall swaying strands = primary hiding cover.
      ctx.save();
      ctx.translate(sx, sy);
      const sway = Math.sin(time * 0.002 + obj.id) * 6;
      ctx.strokeStyle = "#2f7a2a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (let s = -1; s <= 1; s += 1) {
        ctx.beginPath();
        ctx.moveTo(s * 5, 0);
        ctx.quadraticCurveTo(s * 8 + sway, -size * 0.6, s * 6 + sway, -size * 1.2);
        ctx.stroke();
      }
      // leaves
      ctx.fillStyle = "#3a9a2a";
      for (let i = 0; i < 5; i++) {
        const ly = -size * (i / 5);
        ctx.beginPath();
        ctx.ellipse(sway * (i / 5), ly, 8, 4, obj.rotation + i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "seaweed": {
      ctx.save();
      ctx.translate(sx, sy);
      const sway = Math.sin(time * 0.0025 + obj.id * 1.7) * 4;
      ctx.strokeStyle = "rgba(40,110,40,0.8)";
      ctx.lineWidth = 4;
      for (let s = 0; s < 6; s++) {
        const ox = (s - 2.5) * 5;
        ctx.beginPath();
        ctx.moveTo(ox, size * 0.3);
        ctx.quadraticCurveTo(ox + sway, 0, ox + sway * 0.6, -size * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

// Is the given world point inside a hiding/cover zone for this level?
export function isPointInCover(
  levelId: LevelId,
  px: number,
  py: number,
  forest: ForestEntityRefs | null,
  ocean: OceanEnvironment | null,
): boolean {
  if (levelId === "forest") {
    if (!forest) return false;
    const COVER_RADIUS = 42;
    return forest.grassPatches.some((patch) => {
      if (!patch.tall) return false;
      const d = Math.hypot(px - patch.x, py - patch.y);
      return d < patch.spread + COVER_RADIUS;
    });
  }
  // Ocean: kelp & seaweed conceal; barrels/reef also count as soft cover.
  if (!ocean) return false;
  return ocean.objects.some((o) => {
    if (o.kind !== "kelp" && o.kind !== "seaweed" && o.kind !== "barrel") return false;
    const d = Math.hypot(px - o.x, py - o.y);
    return d < o.size + 18;
  });
}