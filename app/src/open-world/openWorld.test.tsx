import { describe, it, expect } from "vitest";
import { joystickVector, resolveContextAction } from "./openWorldControls";
import { QUEST_CATALOG, QUEST_BY_ID } from "./questCatalog";
import { DISTRICTS, type OpenWorldZoneState, type QuestProgress } from "./openWorldTypes";

const LODGE = DISTRICTS.find((d) => d.id === "lodge")!;

function makeZone(overrides: Partial<OpenWorldZoneState> = {}): OpenWorldZoneState {
  return {
    zoneId: "savannahReserve",
    players: [{ id: "u1", username: "Tester", x: LODGE.cx, y: LODGE.cy, animalType: "zebra", selectedCosmetic: null, level: 1 }],
    collectibles: [],
    quests: QUEST_CATALOG,
    activeWorldEvent: null,
    serverTime: Date.now(),
    ...overrides,
  };
}

describe("open-world controls", () => {
  it("joystickVector normalizes magnitude to <= 1", () => {
    const v = joystickVector({ x: 0, y: 0 }, { x: 200, y: 0 }, 60);
    expect(v.magnitude).toBeCloseTo(1, 5);
    expect(v.dx).toBeCloseTo(1, 5);
    expect(v.dy).toBeCloseTo(0, 5);
  });

  it("joystickVector is zero when not dragged", () => {
    const v = joystickVector({ x: 10, y: 10 }, { x: 10, y: 10 }, 60);
    expect(v.magnitude).toBe(0);
  });

  it("resolveContextAction establishes a lodge quest before nearby collectibles", () => {
    const zone = makeZone({
      collectibles: [{ id: "n1", x: LODGE.cx + 10, y: LODGE.cy + 10, kind: "coin", value: 5 }],
    });
    const action = resolveContextAction({
      zone,
      localX: LODGE.cx,
      localY: LODGE.cy,
      questProgress: {},
      lodge: { x: LODGE.cx, y: LODGE.cy },
    });
    expect(action?.kind).toBe("accept");
  });

  it("resolveContextAction prioritizes a nearby collectible once a quest is active", () => {
    const zone = makeZone({ collectibles: [{ id: "n1", x: LODGE.cx + 10, y: LODGE.cy + 10, kind: "coin", value: 5 }] });
    const action = resolveContextAction({
      zone,
      localX: LODGE.cx,
      localY: LODGE.cy,
      questProgress: { repeat_gather_food: { questId: "repeat_gather_food", status: "active", progress: 0, targetCount: 5 } },
      lodge: { x: LODGE.cx, y: LODGE.cy },
    });
    expect(action?.kind).toBe("collect");
    expect(action?.nodeId).toBe("n1");
  });

  it("resolveContextAction offers claim when a quest is complete near the lodge", () => {
    const prog: Record<string, QuestProgress> = {
      repeat_gather_food: { questId: "repeat_gather_food", status: "complete", progress: 5, targetCount: 5 },
    };
    const zone = makeZone();
    const action = resolveContextAction({
      zone,
      localX: LODGE.cx,
      localY: LODGE.cy,
      questProgress: prog,
      lodge: { x: LODGE.cx, y: LODGE.cy },
    });
    expect(action?.kind).toBe("claim");
    expect(action?.questId).toBe("repeat_gather_food");
  });

  it("resolveContextAction offers accept for an available quest near the lodge", () => {
    const prog: Record<string, QuestProgress> = {
      repeat_gather_food: { questId: "repeat_gather_food", status: "available", progress: 0, targetCount: 5 },
    };
    const zone = makeZone();
    const action = resolveContextAction({
      zone,
      localX: LODGE.cx,
      localY: LODGE.cy,
      questProgress: prog,
      lodge: { x: LODGE.cx, y: LODGE.cy },
    });
    expect(action?.kind).toBe("accept");
  });

  it("resolveContextAction returns 'return' when far from the lodge", () => {
    const zone = makeZone({ collectibles: [] });
    const action = resolveContextAction({
      zone,
      localX: 200,
      localY: 200,
      questProgress: {},
      lodge: { x: LODGE.cx, y: LODGE.cy },
    });
    expect(action?.kind).toBe("return");
  });
});

describe("quest catalog", () => {
  it("includes all required repeatable and daily quests", () => {
    const ids = QUEST_CATALOG.map((q) => q.id);
    expect(ids).toContain("repeat_gather_food");
    expect(ids).toContain("repeat_camera_tag");
    expect(ids).toContain("repeat_water_run");
    expect(ids).toContain("daily_scout_tracks");
    expect(ids).toContain("daily_collect_tokens");
    expect(ids).toContain("daily_blend_herd");
  });

  it("reserve cleanup grants a badge", () => {
    expect(QUEST_BY_ID.daily_collect_tokens.reward.badges).toBe(1);
  });
});
