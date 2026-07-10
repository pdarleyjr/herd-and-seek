// Stylized, original procedural animal art for Herd & Seek.
// Used by both the open-world renderer and lobby character previews so the
// same recognizable species look appears everywhere. No external assets.

export type Facing = 1 | -1;

const SAVANNAH_COLORS: Record<string, { body: string; belly: string; mark: string }> = {
  zebra: { body: "#f3f1ea", belly: "#ffffff", mark: "#23211d" },
  gazelle: { body: "#d8a866", belly: "#f0dcb6", mark: "#7a5a30" },
  wildebeest: { body: "#6a5f54", belly: "#8a7e70", mark: "#3a332c" },
  warthog: { body: "#8a6a44", belly: "#b89a6a", mark: "#4a3623" },
  ostrich: { body: "#3a3230", belly: "#564b46", mark: "#1c1816" },
  meerkat: { body: "#c2a06a", belly: "#e8d2a2", mark: "#7a5a30" },
  hyena: { body: "#a08a5e", belly: "#c4b083", mark: "#4a3f28" },
  secretarybird: { body: "#cfc8ba", belly: "#e8e2d4", mark: "#5a5048" },
};

/**
 * Draw a stylized animal centered at (x, y) with the given pixel size.
 * facing mirrors horizontally; t is seconds (for idle bob); walk adds leg motion.
 */
export function drawAnimal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: string,
  facing: Facing = 1,
  t = 0,
  walk = 0,
  isLocal = false,
  overrideColor?: string,
) {
  const bob = Math.sin(t * 2.2) * size * 0.025;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(facing, 1);

  // Soft ground shadow (not mirrored).
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.5, size * 0.42, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const base = SAVANNAH_COLORS[type] ?? { body: overrideColor ?? "#9a8a6a", belly: "#cabf9a", mark: "#3a332c" };
  const draw = SAVANNAH_DRAW[type] ?? drawGeneric;
  draw(ctx, size, t, walk, base);

  if (isLocal) {
    ctx.strokeStyle = "#7fff00";
    ctx.lineWidth = Math.max(2.5, size * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, size * 0.02, size * 0.52, size * 0.56, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

type DrawFn = (ctx: CanvasRenderingContext2D, s: number, t: number, walk: number, c: { body: string; belly: string; mark: string }) => void;

function leg(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, swing: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + swing, y + len);
  ctx.stroke();
}

function body(ctx: CanvasRenderingContext2D, s: number, c: { body: string; belly: string }) {
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.06, s * 0.28, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

const drawGeneric: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(s * 0.34, -s * 0.22, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // legs
  const sw = Math.sin(walk) * s * 0.06;
  leg(ctx, -s * 0.2, s * 0.2, s * 0.28, -sw, s * 0.07, c.mark);
  leg(ctx, s * 0.2, s * 0.2, s * 0.28, sw, s * 0.07, c.mark);
};

const drawZebra: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.05;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.1 - s * 0.05, -s * 0.4);
    ctx.lineTo(i * s * 0.1 + s * 0.05, s * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  // neck + head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.moveTo(s * 0.3, -s * 0.18);
  ctx.lineTo(s * 0.46, -s * 0.42);
  ctx.lineTo(s * 0.56, -s * 0.3);
  ctx.lineTo(s * 0.42, -s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.5, -s * 0.34, s * 0.14, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears + mane
  ctx.fillStyle = c.mark;
  ctx.beginPath();
  ctx.moveTo(s * 0.46, -s * 0.46);
  ctx.lineTo(s * 0.5, -s * 0.56);
  ctx.lineTo(s * 0.53, -s * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(s * 0.36, -s * 0.28);
  ctx.lineTo(s * 0.46, -s * 0.42);
  ctx.stroke();
  const sw = Math.sin(walk) * s * 0.06;
  leg(ctx, -s * 0.2, s * 0.2, s * 0.3, -sw, s * 0.08, c.mark);
  leg(ctx, s * 0.2, s * 0.2, s * 0.3, sw, s * 0.08, c.mark);
};

const drawGazelle: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  // slender neck
  ctx.strokeStyle = c.body;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s * 0.3, -s * 0.2);
  ctx.quadraticCurveTo(s * 0.45, -s * 0.45, s * 0.42, -s * 0.6);
  ctx.stroke();
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.44, -s * 0.62, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // horns
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.42, -s * 0.68);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.82, s * 0.46, -s * 0.84);
  ctx.moveTo(s * 0.46, -s * 0.68);
  ctx.quadraticCurveTo(s * 0.48, -s * 0.82, s * 0.54, -s * 0.84);
  ctx.stroke();
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.18, s * 0.2, s * 0.32, -sw, s * 0.05, c.mark);
  leg(ctx, s * 0.18, s * 0.2, s * 0.32, sw, s * 0.05, c.mark);
};

const drawWildebeest: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  // hump + head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, -s * 0.28, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.36, -s * 0.2, s * 0.16, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // curved horns
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.moveTo(s * 0.34, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.3, -s * 0.46, s * 0.42, -s * 0.48);
  ctx.stroke();
  // beard
  ctx.fillStyle = c.mark;
  ctx.beginPath();
  ctx.moveTo(s * 0.42, -s * 0.16);
  ctx.lineTo(s * 0.46, s * 0.0);
  ctx.lineTo(s * 0.38, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.2, s * 0.2, s * 0.3, -sw, s * 0.09, c.mark);
  leg(ctx, s * 0.2, s * 0.2, s * 0.3, sw, s * 0.09, c.mark);
};

const drawWarthog: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  // snout
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.ellipse(s * 0.42, -s * 0.12, s * 0.14, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // tusks
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.46, -s * 0.1);
  ctx.lineTo(s * 0.5, -s * 0.02);
  ctx.stroke();
  // mane
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.28);
  ctx.lineTo(s * 0.32, -s * 0.22);
  ctx.stroke();
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.18, s * 0.2, s * 0.24, -sw, s * 0.07, c.mark);
  leg(ctx, s * 0.18, s * 0.2, s * 0.24, sw, s * 0.07, c.mark);
};

const drawOstrich: DrawFn = (ctx, s, _t, walk, c) => {
  // tall body
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1, s * 0.3, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // long neck
  ctx.strokeStyle = c.body;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.7, s * 0.28, -s * 0.86);
  ctx.stroke();
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.3, -s * 0.88, s * 0.08, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = "#f0a83a";
  ctx.beginPath();
  ctx.moveTo(s * 0.36, -s * 0.88);
  ctx.lineTo(s * 0.46, -s * 0.86);
  ctx.lineTo(s * 0.36, -s * 0.82);
  ctx.closePath();
  ctx.fill();
  // fluffy tail
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.ellipse(-s * 0.28, -s * 0.2, s * 0.12, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  const sw = Math.sin(walk) * s * 0.06;
  leg(ctx, -s * 0.06, s * 0.18, s * 0.46, -sw, s * 0.05, "#e8a87a");
  leg(ctx, s * 0.12, s * 0.18, s * 0.46, sw, s * 0.05, "#e8a87a");
};

const drawMeerkat: DrawFn = (ctx, s, _t, walk, c) => {
  // standing upright
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.12, s * 0.16, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(0, -s * 0.42, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // eye patches
  ctx.fillStyle = c.mark;
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.44, s * 0.04, s * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.05, -s * 0.44, s * 0.04, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.08, s * 0.09, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.06, s * 0.2, s * 0.18, -sw, s * 0.05, c.mark);
  leg(ctx, s * 0.06, s * 0.2, s * 0.18, sw, s * 0.05, c.mark);
};

const drawHyena: DrawFn = (ctx, s, _t, walk, c) => {
  body(ctx, s, c);
  // sloped back
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.02);
  ctx.quadraticCurveTo(0, -s * 0.32, s * 0.3, -s * 0.18);
  ctx.lineTo(s * 0.3, s * 0.0);
  ctx.lineTo(-s * 0.4, s * 0.05);
  ctx.closePath();
  ctx.fill();
  // spots
  ctx.fillStyle = c.mark;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(-s * 0.3 + i * s * 0.14, -s * 0.1 + (i % 2) * s * 0.06, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.36, -s * 0.22, s * 0.16, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // rounded ears
  ctx.beginPath();
  ctx.arc(s * 0.3, -s * 0.36, s * 0.06, 0, Math.PI * 2);
  ctx.arc(s * 0.42, -s * 0.36, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.2, s * 0.2, s * 0.28, -sw, s * 0.07, c.mark);
  leg(ctx, s * 0.2, s * 0.2, s * 0.28, sw, s * 0.07, c.mark);
};

const drawSecretary: DrawFn = (ctx, s, _t, walk, c) => {
  // long legs + slender body
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.25, s * 0.22, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // crest feathers on head
  ctx.strokeStyle = c.mark;
  ctx.lineWidth = s * 0.03;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(s * 0.2 + i * s * 0.03, -s * 0.5);
    ctx.lineTo(s * 0.26 + i * s * 0.03, -s * 0.64);
    ctx.stroke();
  }
  // head + beak
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(s * 0.22, -s * 0.46, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0a83a";
  ctx.beginPath();
  ctx.moveTo(s * 0.3, -s * 0.46);
  ctx.lineTo(s * 0.42, -s * 0.44);
  ctx.lineTo(s * 0.3, -s * 0.4);
  ctx.closePath();
  ctx.fill();
  // long legs
  const sw = Math.sin(walk) * s * 0.05;
  leg(ctx, -s * 0.06, s * 0.0, s * 0.5, -sw, s * 0.045, "#d8c8a8");
  leg(ctx, s * 0.08, s * 0.0, s * 0.5, sw, s * 0.045, "#d8c8a8");
};

const SAVANNAH_DRAW: Record<string, DrawFn> = {
  zebra: drawZebra,
  gazelle: drawGazelle,
  wildebeest: drawWildebeest,
  warthog: drawWarthog,
  ostrich: drawOstrich,
  meerkat: drawMeerkat,
  hyena: drawHyena,
  secretarybird: drawSecretary,
};

export function isSavannahAnimal(type: string): boolean {
  return type in SAVANNAH_DRAW;
}

export function animalColor(type: string): string {
  return (SAVANNAH_COLORS[type] ?? { body: "#9a8a6a" }).body;
}
