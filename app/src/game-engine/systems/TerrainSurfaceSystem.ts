import { WORLD_SIZE } from "../../types";

export type TerrainMedium = "land" | "wading" | "water";

export type TerrainSurfaceKind =
  | "grass"
  | "dryGrass"
  | "trail"
  | "sand"
  | "rock"
  | "shallowWater"
  | "deepWater";

export interface TerrainSample {
  kind: TerrainSurfaceKind;
  medium: TerrainMedium;
  /** Normalized immersion from dry ground (0) to fully submerged (1). */
  depth: number;
  /** Client presentation/prediction speed modifier. The server remains authoritative. */
  speedMultiplier: number;
  /** Normalized environmental drag used by locomotion and effects. */
  drag: number;
}

interface EllipseRegion {
  shape: "ellipse";
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
  surface: TerrainSurfaceKind;
  innerSurface?: TerrainSurfaceKind;
  innerRatio?: number;
}

interface TrailRegion {
  shape: "trail";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  halfWidth: number;
  surface: TerrainSurfaceKind;
}

type TerrainRegion = EllipseRegion | TrailRegion;

export interface OpenWorldTerrainLayout {
  lodge: { x: number; y: number };
  wateringHole: { x: number; y: number; radiusX?: number; radiusY?: number };
  ridge: { x: number; y: number; radiusX?: number; radiusY?: number };
  trailDestinations: ReadonlyArray<{ x: number; y: number }>;
  secondaryWater?: ReadonlyArray<{ x: number; y: number; radiusX: number; radiusY: number }>;
}

const SURFACES: Record<TerrainSurfaceKind, TerrainSample> = {
  grass: { kind: "grass", medium: "land", depth: 0, speedMultiplier: 1, drag: 0 },
  dryGrass: { kind: "dryGrass", medium: "land", depth: 0, speedMultiplier: 0.98, drag: 0.02 },
  trail: { kind: "trail", medium: "land", depth: 0, speedMultiplier: 1.04, drag: 0 },
  sand: { kind: "sand", medium: "land", depth: 0, speedMultiplier: 0.9, drag: 0.1 },
  rock: { kind: "rock", medium: "land", depth: 0, speedMultiplier: 0.94, drag: 0.05 },
  shallowWater: { kind: "shallowWater", medium: "wading", depth: 0.45, speedMultiplier: 0.72, drag: 0.28 },
  deepWater: { kind: "deepWater", medium: "water", depth: 1, speedMultiplier: 0.58, drag: 0.42 },
};

export class TerrainSurfaceSystem {
  private readonly baseSurface: TerrainSurfaceKind;
  private readonly regions: readonly TerrainRegion[];

  constructor(baseSurface: TerrainSurfaceKind, regions: readonly TerrainRegion[]) {
    this.baseSurface = baseSurface;
    this.regions = regions;
  }

  sample(x: number, y: number): TerrainSample {
    for (const region of this.regions) {
      if (region.shape === "trail") {
        if (distanceToSegment(x, y, region.fromX, region.fromY, region.toX, region.toY) <= region.halfWidth) {
          return SURFACES[region.surface];
        }
        continue;
      }

      const normalizedRadius = Math.hypot(
        (x - region.cx) / Math.max(region.radiusX, 1),
        (y - region.cy) / Math.max(region.radiusY, 1),
      );
      if (normalizedRadius > 1) continue;
      if (region.innerSurface && normalizedRadius <= (region.innerRatio ?? 0.72)) return SURFACES[region.innerSurface];
      return SURFACES[region.surface];
    }
    return SURFACES[this.baseSurface];
  }
}

export function createMatchTerrainSurfaceSystem(levelId: "forest" | "deepDark" | "savannah"): TerrainSurfaceSystem {
  if (levelId === "deepDark") return new TerrainSurfaceSystem("deepWater", []);

  const scale = WORLD_SIZE / 2_000;

  const pond: EllipseRegion = {
    shape: "ellipse",
    cx: 520 * scale,
    cy: 540 * scale,
    radiusX: 230 * scale,
    radiusY: 150 * scale,
    surface: "shallowWater",
    innerSurface: "deepWater",
    innerRatio: 0.72,
  };
  const trails = createMatchTrails(scale);
  return new TerrainSurfaceSystem(levelId === "forest" ? "grass" : "dryGrass", [pond, ...trails]);
}

export function createOpenWorldTerrainSurfaceSystem(layout: OpenWorldTerrainLayout = DEFAULT_OPEN_WORLD_LAYOUT): TerrainSurfaceSystem {
  const wateringHole: EllipseRegion = {
    shape: "ellipse",
    cx: layout.wateringHole.x,
    cy: layout.wateringHole.y,
    radiusX: layout.wateringHole.radiusX ?? 220,
    radiusY: layout.wateringHole.radiusY ?? 155,
    surface: "shallowWater",
    innerSurface: "deepWater",
    innerRatio: 0.76,
  };
  const ridge: EllipseRegion = {
    shape: "ellipse",
    cx: layout.ridge.x,
    cy: layout.ridge.y,
    radiusX: layout.ridge.radiusX ?? 260,
    radiusY: layout.ridge.radiusY ?? 125,
    surface: "rock",
  };
  const secondaryWater: EllipseRegion[] = (layout.secondaryWater ?? []).map((water) => ({
    shape: "ellipse",
    cx: water.x,
    cy: water.y,
    radiusX: water.radiusX,
    radiusY: water.radiusY,
    surface: "shallowWater",
    innerSurface: "deepWater",
    innerRatio: 0.7,
  }));
  const trails: TrailRegion[] = layout.trailDestinations.map(({ x: toX, y: toY }) => ({
    shape: "trail",
    fromX: layout.lodge.x,
    fromY: layout.lodge.y,
    toX,
    toY,
    halfWidth: 56,
    surface: "trail",
  }));
  return new TerrainSurfaceSystem("dryGrass", [wateringHole, ...secondaryWater, ridge, ...trails]);
}

const DEFAULT_OPEN_WORLD_LAYOUT: OpenWorldTerrainLayout = {
  lodge: { x: 3_000, y: 3_000 },
  wateringHole: { x: 4_750, y: 4_450 },
  ridge: { x: 3_100, y: 750 },
  secondaryWater: [{ x: 1_020, y: 1_095, radiusX: 130, radiusY: 75 }],
  trailDestinations: [
    { x: 1_300, y: 3_200 },
    { x: 4_750, y: 4_450 },
    { x: 3_100, y: 750 },
    { x: 4_750, y: 1_450 },
    { x: 1_050, y: 1_050 },
    { x: 4_750, y: 3_000 },
  ],
};

function createMatchTrails(scale: number): TrailRegion[] {
  const points = [
    [-80, 1_540, 520, 1_040],
    [520, 1_040, 1_050, 900],
    [1_050, 900, 1_540, 650],
    [1_540, 650, 2_080, 240],
  ] as const;
  return points.map(([fromX, fromY, toX, toY]) => ({
    shape: "trail",
    fromX: fromX * scale,
    fromY: fromY * scale,
    toX: toX * scale,
    toY: toY * scale,
    halfWidth: 75 * scale,
    surface: "trail",
  }));
}

function distanceToSegment(
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(x - fromX, y - fromY);
  const ratio = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy) / lengthSquared));
  return Math.hypot(x - (fromX + ratio * dx), y - (fromY + ratio * dy));
}
