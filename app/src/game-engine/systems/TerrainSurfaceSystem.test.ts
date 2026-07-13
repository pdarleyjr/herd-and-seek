import { describe, expect, it } from "vitest";
import {
  createMatchTerrainSurfaceSystem,
  createOpenWorldTerrainSurfaceSystem,
} from "./TerrainSurfaceSystem";
import { WORLD_SIZE } from "../../types";

describe("TerrainSurfaceSystem", () => {
  it("distinguishes deep water, wading shallows, trails, and biome ground", () => {
    const terrain = createMatchTerrainSurfaceSystem("forest");
    const scale = WORLD_SIZE / 2_000;

    expect(terrain.sample(520 * scale, 540 * scale)).toMatchObject({ kind: "deepWater", medium: "water" });
    expect(terrain.sample(730 * scale, 540 * scale)).toMatchObject({ kind: "shallowWater", medium: "wading" });
    expect(terrain.sample(1_000 * scale, 913 * scale)).toMatchObject({ kind: "trail", medium: "land" });
    expect(terrain.sample(2_600, 2_600)).toMatchObject({ kind: "grass", medium: "land" });
  });

  it("treats the Deep Dark as an underwater environment", () => {
    const terrain = createMatchTerrainSurfaceSystem("deepDark");

    expect(terrain.sample(2_600, 2_600)).toMatchObject({ kind: "deepWater", medium: "water" });
  });

  it("maps the seamless reserve watering hole and ridge without gaps", () => {
    const terrain = createOpenWorldTerrainSurfaceSystem();

    expect(terrain.sample(4_750, 4_450)).toMatchObject({ kind: "deepWater", medium: "water" });
    expect(terrain.sample(4_950, 4_450)).toMatchObject({ kind: "shallowWater", medium: "wading" });
    expect(terrain.sample(3_100, 750)).toMatchObject({ kind: "rock", medium: "land" });
    expect(terrain.sample(1_020, 1_095)).toMatchObject({ kind: "deepWater", medium: "water" });
    expect(terrain.sample(250, 2_700)).toMatchObject({ kind: "dryGrass", medium: "land" });
  });

  it("derives terrain from expanded-world district coordinates", () => {
    const terrain = createOpenWorldTerrainSurfaceSystem({
      lodge: { x: 4_000, y: 4_000 },
      wateringHole: { x: 7_000, y: 6_000, radiusX: 400, radiusY: 300 },
      ridge: { x: 4_000, y: 900, radiusX: 500, radiusY: 220 },
      trailDestinations: [{ x: 7_000, y: 6_000 }],
    });

    expect(terrain.sample(7_000, 6_000).medium).toBe("water");
    expect(terrain.sample(4_000, 900).kind).toBe("rock");
    expect(terrain.sample(5_500, 5_000).kind).toBe("trail");
  });
});
