import Phaser from "phaser";
import type { AnimalType, LevelId } from "../../types";

/**
 * The animal set intentionally uses one small, original visual grammar:
 * chunky geometric silhouettes, a deep-plum keyline, two-tone bodies and one
 * species-specific landmark. Keeping the metadata pure makes the art contract
 * testable without taking screenshots of Phaser canvases.
 */
export type AnimalBiome = "forest" | "marine" | "savannah";

export type AnimalBodyPlan =
  | "quadruped"
  | "long-neck"
  | "round-bird"
  | "tall-bird"
  | "upright"
  | "serpent"
  | "amphibian"
  | "fish"
  | "shell-swimmer"
  | "crustacean"
  | "tentacled"
  | "ray"
  | "seahorse";

export type AnimalMarking =
  | "plain"
  | "belly"
  | "mask"
  | "patches"
  | "spots"
  | "stripes"
  | "bands"
  | "shell"
  | "mane";

export interface AnimalSpeciesStyle {
  readonly biome: AnimalBiome;
  readonly bodyPlan: AnimalBodyPlan;
  readonly styleName: string;
  readonly base: `#${string}`;
  readonly secondary: `#${string}`;
  readonly accent: `#${string}`;
  readonly marking: AnimalMarking;
  /** The single silhouette cue that makes the species readable at HUD scale. */
  readonly signature: string;
}

const FOREST_GREEN = "#5F9B68";
const FOREST_CREAM = "#FFF0D2";
const MARINE_TEAL = "#30C0B7";
const MARINE_BLUE = "#498099";
const DUSK_GOLD = "#E7B860";
const CORAL = "#FD8083";
const PINK = "#EE227D";
const PLUM = "#3B0855";
const SOFT_PLUM = "#852467";

/** Complete, deterministic style coverage for every playable and legacy animal. */
export const ANIMAL_SPECIES_STYLES: Readonly<Record<AnimalType, AnimalSpeciesStyle>> = Object.freeze({
  rabbit: { biome: "forest", bodyPlan: "quadruped", styleName: "Mossland Hopper", base: "#D7C6A7", secondary: FOREST_CREAM, accent: CORAL, marking: "belly", signature: "long ears" },
  bear: { biome: "forest", bodyPlan: "quadruped", styleName: "Bramble Bear", base: "#76533B", secondary: "#C99D6C", accent: FOREST_GREEN, marking: "belly", signature: "round ears" },
  owl: { biome: "forest", bodyPlan: "round-bird", styleName: "Moonleaf Owl", base: "#8F795B", secondary: FOREST_CREAM, accent: "#F2C94C", marking: "mask", signature: "wide eyes" },
  snake: { biome: "forest", bodyPlan: "serpent", styleName: "Ferncoil Snake", base: FOREST_GREEN, secondary: "#A6D47A", accent: PINK, marking: "bands", signature: "coiled body" },
  frog: { biome: "forest", bodyPlan: "amphibian", styleName: "Pondskip Frog", base: "#57B86A", secondary: "#B9E77A", accent: CORAL, marking: "belly", signature: "high eyes" },
  duck: { biome: "forest", bodyPlan: "round-bird", styleName: "Reed Duck", base: "#6A8D72", secondary: "#D9E5BC", accent: "#F0A33B", marking: "belly", signature: "flat bill" },
  dog: { biome: "forest", bodyPlan: "quadruped", styleName: "Trail Dog", base: "#B77B43", secondary: "#F1C987", accent: MARINE_TEAL, marking: "patches", signature: "floppy ear" },
  panda: { biome: "forest", bodyPlan: "quadruped", styleName: "Bamboo Panda", base: "#F4EEDC", secondary: "#5A3B62", accent: FOREST_GREEN, marking: "mask", signature: "eye patches" },
  elephant: { biome: "savannah", bodyPlan: "quadruped", styleName: "Dusk Elephant", base: "#9C8FA3", secondary: "#C9BAC5", accent: CORAL, marking: "plain", signature: "trunk" },
  penguin: { biome: "marine", bodyPlan: "round-bird", styleName: "Tide Penguin", base: "#45566A", secondary: "#F5EFD8", accent: CORAL, marking: "belly", signature: "flippers" },
  monkey: { biome: "forest", bodyPlan: "upright", styleName: "Canopy Monkey", base: "#8A5D3B", secondary: "#D6A66D", accent: MARINE_TEAL, marking: "mask", signature: "curling tail" },
  giraffe: { biome: "savannah", bodyPlan: "long-neck", styleName: "Sunset Giraffe", base: DUSK_GOLD, secondary: "#9B623E", accent: CORAL, marking: "spots", signature: "tall neck" },
  horse: { biome: "savannah", bodyPlan: "quadruped", styleName: "Prairie Horse", base: "#9A633E", secondary: "#E0B47D", accent: SOFT_PLUM, marking: "mane", signature: "swept mane" },
  pig: { biome: "forest", bodyPlan: "quadruped", styleName: "Truffle Pig", base: "#E6929D", secondary: "#FFC2BC", accent: FOREST_GREEN, marking: "patches", signature: "disc snout" },
  cow: { biome: "savannah", bodyPlan: "quadruped", styleName: "Meadow Cow", base: "#F0E8D7", secondary: "#5A425D", accent: CORAL, marking: "patches", signature: "short horns" },
  parrot: { biome: "forest", bodyPlan: "round-bird", styleName: "Canopy Parrot", base: "#2DAF87", secondary: "#F2D34F", accent: PINK, marking: "patches", signature: "hooked beak" },
  fish: { biome: "marine", bodyPlan: "fish", styleName: "Coralstripe Fish", base: CORAL, secondary: "#FFD88A", accent: MARINE_TEAL, marking: "stripes", signature: "fan tail" },
  turtle: { biome: "marine", bodyPlan: "shell-swimmer", styleName: "Reef Turtle", base: "#4FA86B", secondary: "#A8D07A", accent: MARINE_TEAL, marking: "shell", signature: "patterned shell" },
  crab: { biome: "marine", bodyPlan: "crustacean", styleName: "Coral Crab", base: "#E76368", secondary: CORAL, accent: "#FFD88A", marking: "plain", signature: "raised claws" },
  octopus: { biome: "marine", bodyPlan: "tentacled", styleName: "Kelp Octopus", base: SOFT_PLUM, secondary: "#C15B93", accent: MARINE_TEAL, marking: "spots", signature: "eight arms" },
  jellyfish: { biome: "marine", bodyPlan: "tentacled", styleName: "Bloom Jelly", base: "#D36AA8", secondary: "#F5A7C6", accent: MARINE_TEAL, marking: "bands", signature: "bell and tendrils" },
  shark: { biome: "marine", bodyPlan: "fish", styleName: "Deepwater Shark", base: MARINE_BLUE, secondary: "#A9CDD0", accent: CORAL, marking: "belly", signature: "dorsal fin" },
  seahorse: { biome: "marine", bodyPlan: "seahorse", styleName: "Sunreef Seahorse", base: "#EAC94F", secondary: "#FFF09A", accent: PINK, marking: "bands", signature: "curled tail" },
  stingray: { biome: "marine", bodyPlan: "ray", styleName: "Lagoon Ray", base: "#397E86", secondary: "#72C4BA", accent: CORAL, marking: "spots", signature: "diamond wings" },
  zebra: { biome: "savannah", bodyPlan: "quadruped", styleName: "Dusk Zebra", base: "#F0E9D7", secondary: PLUM, accent: CORAL, marking: "stripes", signature: "bold stripes" },
  gazelle: { biome: "savannah", bodyPlan: "quadruped", styleName: "Sungrass Gazelle", base: "#C89558", secondary: "#F3D39A", accent: SOFT_PLUM, marking: "belly", signature: "swept horns" },
  wildebeest: { biome: "savannah", bodyPlan: "quadruped", styleName: "Storm Wildebeest", base: "#655C57", secondary: "#9B8D76", accent: CORAL, marking: "mane", signature: "wide horns" },
  warthog: { biome: "savannah", bodyPlan: "quadruped", styleName: "Dust Warthog", base: "#7D5D43", secondary: "#B88B61", accent: "#F3D39A", marking: "mane", signature: "tusks" },
  ostrich: { biome: "savannah", bodyPlan: "tall-bird", styleName: "Nightplume Ostrich", base: "#514050", secondary: "#D7C7BA", accent: CORAL, marking: "belly", signature: "long legs" },
  meerkat: { biome: "savannah", bodyPlan: "upright", styleName: "Dune Meerkat", base: "#B79162", secondary: "#E1C58F", accent: SOFT_PLUM, marking: "mask", signature: "lookout stance" },
  hyena: { biome: "savannah", bodyPlan: "quadruped", styleName: "Dusk Hyena", base: "#A1845D", secondary: "#D2B67C", accent: SOFT_PLUM, marking: "spots", signature: "sloped back" },
  secretarybird: { biome: "savannah", bodyPlan: "tall-bird", styleName: "Grassland Secretary", base: "#D9D1C1", secondary: "#56506A", accent: PINK, marking: "patches", signature: "crest feathers" },
});

export function animalTextureKey(animal: AnimalType): string {
  return `animal-${animal}`;
}

export function speciesStyleFor(animal: AnimalType): AnimalSpeciesStyle {
  return ANIMAL_SPECIES_STYLES[animal];
}

export function ensureAnimalTexture(scene: Phaser.Scene, animal: AnimalType): string {
  const key = animalTextureKey(animal);
  if (scene.textures.exists(key)) return key;

  const style = speciesStyleFor(animal);
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  drawSpecies(graphics, animal, style);
  graphics.generateTexture(key, 96, 96);
  graphics.destroy();
  return key;
}

export function hunterTextureFor(levelId: LevelId): string {
  return `hunter-${levelId}`;
}

const OUTLINE = 0x3b0855;
const EYE_WHITE = 0xfff4de;

function hex(value: `#${string}`): number {
  return Number.parseInt(value.slice(1), 16);
}

function drawSpecies(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  switch (style.bodyPlan) {
    case "quadruped": drawQuadruped(g, animal, style); break;
    case "long-neck": drawLongNeck(g, style); break;
    case "round-bird": drawRoundBird(g, animal, style); break;
    case "tall-bird": drawTallBird(g, animal, style); break;
    case "upright": drawUpright(g, animal, style); break;
    case "serpent": drawSerpent(g, style); break;
    case "amphibian": drawFrog(g, style); break;
    case "fish": drawFish(g, animal, style); break;
    case "shell-swimmer": drawTurtle(g, style); break;
    case "crustacean": drawCrab(g, style); break;
    case "tentacled": drawTentacled(g, animal, style); break;
    case "ray": drawRay(g, style); break;
    case "seahorse": drawSeahorse(g, style); break;
  }
}

function outlinedEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number): void {
  g.fillStyle(OUTLINE, 1).fillEllipse(x, y, width + 7, height + 7);
  g.fillStyle(color, 1).fillEllipse(x, y, width, height);
}

function outlinedCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
  g.fillStyle(OUTLINE, 1).fillCircle(x, y, radius + 3.5);
  g.fillStyle(color, 1).fillCircle(x, y, radius);
}

function outlinedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, radius = 3): void {
  g.fillStyle(OUTLINE, 1).fillRoundedRect(x - 3, y - 3, width + 6, height + 6, radius + 2);
  g.fillStyle(color, 1).fillRoundedRect(x, y, width, height, radius);
}

function outlinedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, width: number, color: number): void {
  g.lineStyle(width + 6, OUTLINE, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(width, color, 1).lineBetween(x1, y1, x2, y2);
  outlinedCircle(g, x2, y2, Math.max(2, width / 2), color);
}

function eye(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  outlinedCircle(g, x, y, 4.3, EYE_WHITE);
  g.fillStyle(OUTLINE, 1).fillCircle(x + 1.2, y, 2.1);
  g.fillStyle(0xffffff, 1).fillCircle(x + 0.4, y - 1, 0.9);
}

function triangle(g: Phaser.GameObjects.Graphics, points: readonly [number, number, number, number, number, number], color: number): void {
  const [x1, y1, x2, y2, x3, y3] = points;
  g.fillStyle(color, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
  g.lineStyle(6, OUTLINE, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
}

function drawQuadruped(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);

  // Chunky, evenly keyed feet establish the shared toy-block grammar.
  outlinedRect(g, 23, 62, 10, 24, base);
  outlinedRect(g, 44, 64, 10, 22, base);
  outlinedRect(g, 62, 61, 10, 25, base);

  if (animal === "elephant") {
    outlinedEllipse(g, 43, 50, 60, 39, base);
    outlinedCircle(g, 69, 42, 21, base);
    outlinedCircle(g, 61, 43, 15, secondary);
    outlinedLine(g, 79, 48, 78, 75, 9, base);
    outlinedLine(g, 77, 74, 86, 78, 7, base);
    eye(g, 75, 36);
    return;
  }

  // Tail, body and head are layered back-to-front for a readable side view.
  if (animal === "rabbit") outlinedCircle(g, 13, 49, 7, secondary);
  else if (animal === "pig") outlinedLine(g, 17, 50, 8, 43, 4, accent);
  else outlinedLine(g, 19, 48, 7, animal === "horse" ? 31 : 39, animal === "horse" ? 7 : 4, style.marking === "mane" ? secondary : base);

  outlinedEllipse(g, 44, 51, animal === "hyena" ? 60 : 58, animal === "warthog" ? 31 : 36, base);
  outlinedEllipse(g, 71, 40, animal === "bear" || animal === "panda" ? 34 : 31, animal === "rabbit" ? 28 : 30, base);

  if (style.marking === "belly") {
    g.fillStyle(secondary, 1).fillEllipse(45, 58, 34, 17);
  } else if (style.marking === "patches" || style.marking === "spots") {
    const radius = style.marking === "spots" ? 4 : 7;
    g.fillStyle(secondary, 1).fillCircle(31, 44, radius).fillCircle(48, 56, radius - 1).fillCircle(61, 45, radius - 2);
  } else if (style.marking === "stripes") {
    for (const x of [29, 40, 52, 63]) outlinedLine(g, x, 37, x + 5, 62, 3, secondary);
  } else if (style.marking === "mane") {
    outlinedLine(g, 58, 33, 61, 58, 7, secondary);
  }

  // Species landmarks are deliberately exaggerated so they survive 64px NPC rendering.
  if (animal === "rabbit") {
    outlinedRect(g, 61, 6, 9, 26, base, 5);
    outlinedRect(g, 75, 4, 9, 28, base, 5);
    g.fillStyle(accent, 1).fillRoundedRect(64, 9, 3, 18, 2).fillRoundedRect(78, 7, 3, 20, 2);
  } else if (animal === "bear" || animal === "panda") {
    outlinedCircle(g, 61, 25, 7, secondary);
    outlinedCircle(g, 80, 24, 7, secondary);
  } else if (animal === "dog") {
    outlinedEllipse(g, 62, 26, 12, 20, secondary);
  } else if (animal === "pig") {
    triangle(g, [59, 29, 62, 17, 69, 29], base);
    triangle(g, [75, 28, 83, 17, 84, 32], base);
  } else {
    triangle(g, [59, 30, 62, 19, 70, 31], base);
    triangle(g, [74, 29, 82, 18, 84, 33], base);
  }

  if (animal === "panda") {
    outlinedEllipse(g, 65, 37, 10, 13, secondary);
    outlinedEllipse(g, 78, 37, 10, 13, secondary);
  }

  if (animal === "cow" || animal === "gazelle" || animal === "wildebeest") {
    const hornColor = animal === "wildebeest" ? secondary : accent;
    outlinedLine(g, 65, 27, animal === "gazelle" ? 58 : 53, animal === "gazelle" ? 7 : 19, 3, hornColor);
    outlinedLine(g, 77, 27, animal === "gazelle" ? 85 : 89, animal === "gazelle" ? 7 : 19, 3, hornColor);
  }

  if (animal === "warthog") {
    triangle(g, [78, 46, 94, 43, 80, 52], secondary);
  }

  const muzzleColor = animal === "zebra" ? hex("#D7C9BB") : secondary;
  outlinedEllipse(g, 79, 48, animal === "pig" ? 19 : 17, 13, muzzleColor);
  if (animal === "pig") g.fillStyle(OUTLINE, 1).fillCircle(75, 48, 1.8).fillCircle(82, 48, 1.8);
  eye(g, 71, 36);
}

function drawLongNeck(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  outlinedRect(g, 25, 61, 9, 27, base);
  outlinedRect(g, 51, 61, 9, 27, base);
  outlinedEllipse(g, 40, 56, 45, 29, base);
  outlinedRect(g, 53, 18, 12, 44, base, 5);
  outlinedEllipse(g, 68, 18, 30, 20, base);
  for (const [x, y, r] of [[32, 50, 4], [47, 58, 4], [58, 34, 3], [69, 18, 3]] as const) outlinedCircle(g, x, y, r, secondary);
  outlinedLine(g, 62, 10, 60, 2, 3, secondary);
  outlinedLine(g, 74, 10, 76, 2, 3, secondary);
  triangle(g, [55, 16, 48, 9, 59, 20], base);
  triangle(g, [76, 15, 87, 9, 80, 21], base);
  outlinedLine(g, 20, 51, 8, 38, 4, secondary);
  eye(g, 72, 16);
}

function drawRoundBird(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  outlinedLine(g, 39, 70, 36, 87, 4, accent);
  outlinedLine(g, 57, 70, 61, 87, 4, accent);
  outlinedEllipse(g, 47, 55, animal === "duck" ? 52 : 44, animal === "duck" ? 36 : 55, base);
  outlinedEllipse(g, animal === "duck" ? 63 : 49, 30, animal === "owl" ? 38 : 32, animal === "owl" ? 31 : 30, base);
  outlinedEllipse(g, 43, 57, 26, 32, secondary);

  if (animal === "owl") {
    outlinedCircle(g, 41, 29, 9, secondary);
    outlinedCircle(g, 57, 29, 9, secondary);
    eye(g, 41, 29);
    eye(g, 57, 29);
    triangle(g, [46, 38, 52, 38, 49, 45], accent);
  } else {
    if (animal === "penguin") {
      g.fillStyle(secondary, 1).fillEllipse(48, 57, 26, 38);
      triangle(g, [26, 48, 11, 62, 31, 66], base);
      triangle(g, [69, 48, 84, 62, 64, 66], base);
    }
    if (animal === "parrot") triangle(g, [47, 18, 42, 4, 56, 19], hex(style.accent));
    const billWidth = animal === "duck" ? 24 : 14;
    triangle(g, [72, 31, 72 + billWidth, 36, 72, 41], accent);
    eye(g, animal === "duck" ? 64 : 56, 28);
  }
}

function drawTallBird(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  outlinedLine(g, 37, 56, 31, 90, 5, accent);
  outlinedLine(g, 51, 56, 60, 90, 5, accent);
  outlinedEllipse(g, 39, 49, 45, 35, base);
  outlinedEllipse(g, 34, 49, 25, 24, secondary);
  outlinedLine(g, 51, 39, 61, 15, animal === "ostrich" ? 8 : 6, base);
  outlinedCircle(g, 65, 13, 10, base);
  triangle(g, [71, 11, 92, 17, 72, 22], accent);
  if (animal === "secretarybird") {
    for (const y of [6, 11, 16]) outlinedLine(g, 59, y + 4, 46, y, 2, secondary);
    g.fillStyle(secondary, 1).fillRect(28, 65, 8, 18).fillRect(55, 65, 8, 18);
  }
  eye(g, 66, 11);
}

function drawUpright(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  outlinedLine(g, 35, 65, 29, 88, 7, base);
  outlinedLine(g, 57, 65, 64, 88, 7, base);
  outlinedEllipse(g, 47, 54, animal === "meerkat" ? 31 : 39, 55, base);
  outlinedCircle(g, 48, 25, animal === "meerkat" ? 15 : 19, base);
  outlinedEllipse(g, 48, 29, 21, 15, secondary);
  outlinedCircle(g, 34, 19, 7, secondary);
  outlinedCircle(g, 62, 19, 7, secondary);
  outlinedLine(g, 31, 53, 17, 62, 6, base);
  outlinedLine(g, 61, 53, 76, 44, 6, base);
  if (animal === "monkey") {
    g.lineStyle(10, OUTLINE, 1).beginPath().moveTo(33, 66).lineTo(17, 73).lineTo(13, 55).strokePath();
    g.lineStyle(4, accent, 1).beginPath().moveTo(33, 66).lineTo(17, 73).lineTo(13, 55).strokePath();
  } else {
    outlinedLine(g, 36, 69, 21, 81, 5, base);
  }
  eye(g, 42, 23);
  eye(g, 54, 23);
}

function drawSerpent(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  const segments = [[23, 68, 15], [38, 72, 16], [54, 67, 16], [65, 55, 14], [67, 39, 13]] as const;
  for (const [x, y, r] of segments) outlinedCircle(g, x, y, r, base);
  for (const [x, y] of [[28, 68], [49, 68], [65, 51]] as const) outlinedLine(g, x - 3, y - 8, x + 4, y + 7, 3, secondary);
  outlinedEllipse(g, 69, 25, 30, 22, base);
  eye(g, 74, 22);
  outlinedLine(g, 82, 28, 93, 30, 2, accent);
}

function drawFrog(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  outlinedLine(g, 35, 63, 14, 82, 9, base);
  outlinedLine(g, 60, 63, 82, 82, 9, base);
  outlinedEllipse(g, 48, 58, 54, 39, base);
  outlinedCircle(g, 35, 36, 12, base);
  outlinedCircle(g, 61, 36, 12, base);
  eye(g, 35, 34);
  eye(g, 61, 34);
  g.fillStyle(secondary, 1).fillEllipse(48, 65, 30, 15);
  g.lineStyle(4, accent, 1).beginPath().moveTo(38, 57).lineTo(48, 62).lineTo(58, 57).strokePath();
}

function drawFish(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  triangle(g, [24, 48, 4, 25, 4, 72], accent);
  outlinedEllipse(g, 50, 49, animal === "shark" ? 67 : 61, animal === "shark" ? 34 : 40, base);
  if (animal === "shark") triangle(g, [45, 34, 57, 8, 65, 37], base);
  else triangle(g, [43, 34, 50, 19, 59, 36], secondary);
  if (style.marking === "stripes") {
    for (const x of [35, 47, 59]) outlinedLine(g, x, 34, x + 2, 63, 3, secondary);
  } else {
    g.fillStyle(secondary, 1).fillEllipse(52, 58, 38, 11);
  }
  triangle(g, [49, 58, 59, 80, 67, 57], secondary);
  eye(g, 70, 43);
}

function drawTurtle(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  triangle(g, [30, 35, 8, 25, 20, 49], base);
  triangle(g, [65, 35, 88, 24, 76, 49], base);
  triangle(g, [30, 67, 11, 79, 24, 55], base);
  triangle(g, [66, 67, 85, 80, 74, 55], base);
  outlinedCircle(g, 48, 14, 10, base);
  outlinedEllipse(g, 48, 52, 55, 64, secondary);
  g.lineStyle(4, OUTLINE, 1).strokeEllipse(48, 52, 40, 49).lineBetween(48, 29, 48, 76).lineBetween(29, 52, 67, 52);
  g.fillStyle(accent, 1).fillCircle(37, 41, 3).fillCircle(59, 63, 3);
  eye(g, 52, 12);
}

function drawCrab(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  for (const y of [49, 60, 70]) {
    outlinedLine(g, 31, y, 11, y + 10, 4, base);
    outlinedLine(g, 65, y, 85, y + 10, 4, base);
  }
  outlinedCircle(g, 14, 31, 12, secondary);
  outlinedCircle(g, 82, 31, 12, secondary);
  outlinedLine(g, 26, 44, 17, 35, 6, base);
  outlinedLine(g, 70, 44, 79, 35, 6, base);
  outlinedEllipse(g, 48, 56, 51, 39, base);
  outlinedCircle(g, 38, 39, 7, EYE_WHITE);
  outlinedCircle(g, 58, 39, 7, EYE_WHITE);
  g.fillStyle(OUTLINE, 1).fillCircle(39, 39, 2.5).fillCircle(57, 39, 2.5);
}

function drawTentacled(g: Phaser.GameObjects.Graphics, animal: AnimalType, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  const isJelly = animal === "jellyfish";
  const armCount = isJelly ? 5 : 6;
  for (let index = 0; index < armCount; index += 1) {
    const x = 25 + index * (isJelly ? 11 : 9);
    outlinedLine(g, x, 56, x + (index % 2 === 0 ? -5 : 5), 88, isJelly ? 4 : 7, index % 2 === 0 ? secondary : base);
  }
  if (isJelly) {
    outlinedEllipse(g, 48, 40, 57, 45, base);
    g.fillStyle(OUTLINE, 1).fillRect(20, 40, 56, 17);
    g.fillStyle(base, 1).fillRect(23, 40, 50, 13);
    g.lineStyle(4, accent, 1).lineBetween(29, 35, 67, 35);
  } else {
    outlinedEllipse(g, 48, 39, 51, 51, base);
    g.fillStyle(secondary, 1).fillCircle(32, 36, 4).fillCircle(64, 27, 3).fillCircle(61, 49, 3);
  }
  eye(g, 39, 39);
  eye(g, 57, 39);
}

function drawRay(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  triangle(g, [48, 12, 7, 52, 48, 78], base);
  triangle(g, [48, 12, 89, 52, 48, 78], base);
  outlinedLine(g, 48, 71, 50, 94, 4, secondary);
  g.fillStyle(secondary, 1).fillEllipse(48, 52, 27, 34);
  g.fillStyle(accent, 1).fillCircle(27, 49, 3).fillCircle(68, 52, 3);
  eye(g, 41, 40);
  eye(g, 56, 40);
}

function drawSeahorse(g: Phaser.GameObjects.Graphics, style: AnimalSpeciesStyle): void {
  const base = hex(style.base);
  const secondary = hex(style.secondary);
  const accent = hex(style.accent);
  outlinedCircle(g, 52, 24, 15, base);
  triangle(g, [64, 20, 90, 29, 65, 35], accent);
  outlinedEllipse(g, 45, 53, 24, 39, base);
  outlinedLine(g, 43, 68, 57, 81, 8, base);
  outlinedLine(g, 57, 81, 47, 91, 7, base);
  outlinedCircle(g, 44, 91, 7, secondary);
  for (const y of [43, 54, 65]) outlinedLine(g, 37, y, 52, y + 2, 3, secondary);
  triangle(g, [34, 38, 19, 53, 37, 58], accent);
  eye(g, 56, 21);
}
