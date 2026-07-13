// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  ALL_ANIMAL_TYPES,
  ANIMAL_OPTIONS,
  FOREST_ANIMALS,
  OCEAN_ANIMALS,
  SAVANNAH_ANIMALS,
  type AnimalType,
} from "../../types";

// Asset metadata is pure; Phaser itself probes a real Canvas during module
// initialization, so the unit suite replaces that browser-only dependency.
vi.mock("phaser", () => ({ default: {} }));

import {
  ANIMAL_SPECIES_STYLES,
  animalTextureKey,
  ensureAnimalTexture,
  speciesStyleFor,
} from "./AssetRegistry";

describe("animal art registry", () => {
  it("describes every animal option exactly once", () => {
    const optionSpecies = ANIMAL_OPTIONS.map((option) => option.value).sort();
    const styledSpecies = Object.keys(ANIMAL_SPECIES_STYLES).sort();

    expect(styledSpecies).toEqual(optionSpecies);
    expect(styledSpecies).toEqual([...ALL_ANIMAL_TYPES].sort());
  });

  it("provides complete, valid style metadata", () => {
    for (const animal of ALL_ANIMAL_TYPES) {
      const style = speciesStyleFor(animal);

      expect(["forest", "marine", "savannah"]).toContain(style.biome);
      expect(style.bodyPlan.length).toBeGreaterThan(2);
      expect(style.styleName.length).toBeGreaterThan(4);
      expect(style.signature.length).toBeGreaterThan(2);
      expect(style.base).toMatch(/^#[0-9A-F]{6}$/i);
      expect(style.secondary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(style.accent).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("keeps each active level roster in its contextual biome", () => {
    expect(FOREST_ANIMALS.every((animal) => speciesStyleFor(animal).biome === "forest")).toBe(true);
    expect(OCEAN_ANIMALS.every((animal) => speciesStyleFor(animal).biome === "marine")).toBe(true);
    expect(SAVANNAH_ANIMALS.every((animal) => speciesStyleFor(animal).biome === "savannah")).toBe(true);
  });

  it("uses stable, collision-free texture keys", () => {
    const keys = ALL_ANIMAL_TYPES.map(animalTextureKey);
    expect(new Set(keys).size).toBe(ALL_ANIMAL_TYPES.length);

    for (const animal of ALL_ANIMAL_TYPES) {
      expect(animalTextureKey(animal)).toBe(`animal-${animal}`);
    }
  });

  it("returns an existing cached texture without rebuilding it", () => {
    const graphicsFactory = vi.fn();
    const scene = {
      textures: { exists: vi.fn(() => true) },
      make: { graphics: graphicsFactory },
    };

    expect(ensureAnimalTexture(scene as never, "rabbit" as AnimalType)).toBe("animal-rabbit");
    expect(graphicsFactory).not.toHaveBeenCalled();
  });
});
