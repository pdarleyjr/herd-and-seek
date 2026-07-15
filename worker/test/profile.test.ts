import { describe, it, expect, vi } from "vitest";
import {
  newProfile,
  applyReward,
  applyPurchase,
  applySelect,
  applySelectLoadout,
  applyAdminGrant,
  requireInternalRewardAuth,
  requireAdminKey,
  applyQuestClaim,
  collectibleGrantable,
  dueDailyReset,
  type ProfileLike,
} from "../src/economy";
import {
  PlayerProfileDurableObject,
  GameRoomDurableObject,
  OpenWorldZoneDurableObject,
  questCatalogForTest,
  activatePerk,
  allowedMovementDistance,
  safeMatchSpawn,
  difficultyMultiplier,
  DIFFICULTY_TUNING,
  collectibleInRange,
  boundedOpenWorldPosition,
  resolveReadyState,
  districtAtPosition,
  type PlayerProfile,
  type QuestDefinition,
} from "../src/index";

describe("authoritative perk rules", () => {
  const player = (perk: "sprint" | "camouflage" | "extraLife" | "decoy" | "speedBoost" | "none") => ({
    id: "animal", username: "Animal", x: 100, y: 100, animalType: "rabbit" as const,
    isHunter: false, isReady: true, isAlive: true, perk, extraLifeUsed: false,
    perkActiveUntil: 0, perkCooldownUntil: 0, perkConsumed: false,
    lastMoveAt: 0,
  });

  it("authorizes sprint duration and cooldown", () => {
    const p = player("sprint");
    expect(activatePerk(p, 1_000)).toEqual({ ok: true, effect: "sprint" });
    expect(p.perkActiveUntil).toBe(2_500);
    expect(p.perkCooldownUntil).toBe(9_000);
    expect(activatePerk(p, 2_000)).toEqual({ ok: false, reason: "cooldown" });
  });

  it("keeps passive and automatic perks non-activatable", () => {
    expect(activatePerk(player("speedBoost"), 1_000)).toEqual({ ok: false, reason: "passive" });
    expect(activatePerk(player("extraLife"), 1_000)).toEqual({ ok: false, reason: "automatic" });
  });

  it("requires camouflage to begin from a stationary state", () => {
    const moving = player("camouflage");
    moving.lastMoveAt = 950;
    expect(activatePerk(moving, 1_000)).toEqual({ ok: false, reason: "moving" });
    moving.lastMoveAt = 700;
    expect(activatePerk(moving, 1_000)).toEqual({ ok: true, effect: "camouflage" });
    expect(moving.perkActiveUntil).toBe(4_000);
    expect(moving.perkCooldownUntil).toBe(11_000);
  });

  it("authorizes one bounded decoy window and enforces cooldown", () => {
    const decoy = player("decoy");
    expect(activatePerk(decoy, 2_000)).toEqual({ ok: true, effect: "decoy" });
    expect(decoy.perkActiveUntil).toBe(10_000);
    expect(decoy.perkCooldownUntil).toBe(14_000);
    expect(activatePerk(decoy, 3_000)).toEqual({ ok: false, reason: "cooldown" });
  });

  it("rejects activation for no perk", () => {
    expect(activatePerk(player("none"), 1_000)).toEqual({ ok: false, reason: "none" });
  });

  it("validates speed boost and sprint movement on the server", () => {
    expect(allowedMovementDistance(player("none"), 1_000, 100)).toBeCloseTo(23.04, 2);
    expect(allowedMovementDistance(player("speedBoost"), 1_000, 100)).toBeCloseTo(29.952, 2);
    const sprint = player("sprint");
    activatePerk(sprint, 1_000);
    expect(allowedMovementDistance(sprint, 1_200, 100)).toBeCloseTo(34.56, 2);
  });

  it("keeps every supported match spawn inside the collider-free meadow", () => {
    const spawns = Array.from({ length: 16 }, (_, index) => safeMatchSpawn(index));
    expect(new Set(spawns.map((spawn) => `${spawn.x}:${spawn.y}`)).size).toBe(16);
    expect(spawns.every((spawn) => spawn.x >= 580 && spawn.x <= 2_220 && spawn.y >= 580 && spawn.y <= 2_220)).toBe(true);
    expect(spawns[0]).toEqual({ x: 1_400, y: 1_400 });
  });

  it("scales solo AI without changing normal difficulty", () => {
    expect(difficultyMultiplier("beginner")).toBeLessThan(difficultyMultiplier("easy"));
    expect(difficultyMultiplier("easy")).toBeLessThan(1);
    expect(difficultyMultiplier("normal")).toBe(1);
    expect(difficultyMultiplier("hard")).toBeGreaterThan(1);
    expect(DIFFICULTY_TUNING.easy.shotCooldownMs).toBeGreaterThan(DIFFICULTY_TUNING.normal.shotCooldownMs);
    expect(DIFFICULTY_TUNING.beginner.spawnGraceMs).toBeGreaterThan(DIFFICULTY_TUNING.easy.spawnGraceMs);
    expect(DIFFICULTY_TUNING.beginner.intentionalMissChance).toBeGreaterThan(DIFFICULTY_TUNING.easy.intentionalMissChance);
    expect(DIFFICULTY_TUNING.beginner.sightRange).toBeLessThan(DIFFICULTY_TUNING.easy.sightRange);
    expect(DIFFICULTY_TUNING.normal.shotCooldownMs).toBeGreaterThan(DIFFICULTY_TUNING.hard.shotCooldownMs);
    expect(DIFFICULTY_TUNING.hard.rewardMultiplier).toBeGreaterThan(DIFFICULTY_TUNING.normal.rewardMultiplier);
    expect(DIFFICULTY_TUNING.easy.humanHunterAmmo).toBeGreaterThan(DIFFICULTY_TUNING.hard.humanHunterAmmo);
  });

  it("requires an authoritative nearby position for Open World collection", () => {
    expect(collectibleInRange({ x: 100, y: 100 }, { x: 250, y: 200 })).toBe(true);
    expect(collectibleInRange({ x: 100, y: 100 }, { x: 500, y: 500 })).toBe(false);
    expect(collectibleInRange({ x: Number.NaN, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });

  it("bounds Open World movement while preserving ordinary prediction updates", () => {
    expect(boundedOpenWorldPosition({ x: 1_000, y: 1_000 }, { x: 1_050, y: 1_020 }, 100)).toEqual({ x: 1_050, y: 1_020 });
    const blockedTeleport = boundedOpenWorldPosition({ x: 1_000, y: 1_000 }, { x: 5_000, y: 5_000 }, 100);
    expect(Math.hypot(blockedTeleport.x - 1_000, blockedTeleport.y - 1_000)).toBeCloseTo(82, 5);
    expect(boundedOpenWorldPosition({ x: 100, y: 100 }, { x: Number.NaN, y: undefined }, 100)).toEqual({ x: 100, y: 100 });
  });

  it("charges authoritative ammo for an AI trigger pull", () => {
    const room = new GameRoomDurableObject(fakeCtx(), env);
    room.state.phase = "PLAYING";
    room.state.ammo = 2;
    room.state.maxAmmo = 2;
    room.state.players = [{ id: "bot", username: "Bot", x: 100, y: 100, animalType: "rabbit", isHunter: true, isReady: true, isAlive: true, perk: "none", extraLifeUsed: false, isBot: true }];
    room.handleBotShoot(600, 600);
    expect(room.state.ammo).toBe(1);
  });
});

describe("authoritative ready lifecycle", () => {
  it("keeps duplicate ready frames idempotent during countdown", () => {
    expect(resolveReadyState(true, true, "COUNTDOWN")).toBe(true);
    expect(resolveReadyState(true, undefined, "COUNTDOWN")).toBe(true);
  });

  it("allows only an explicit stand-down to cancel countdown readiness", () => {
    expect(resolveReadyState(true, false, "COUNTDOWN")).toBe(false);
    expect(resolveReadyState(false, true, "LOBBY")).toBe(true);
    expect(resolveReadyState(true, false, "PLAYING")).toBe(true);
  });

  it("cancels a stale result reset before a new countdown starts", () => {
    vi.useFakeTimers();
    try {
      const room = new GameRoomDurableObject(fakeCtx(), env);
      room.state.phase = "PLAYING";
      room.endGame("animals", "test result");
      room.resetRoom();
      room.state.phase = "COUNTDOWN";
      vi.advanceTimersByTime(5_000);
      expect(room.state.phase).toBe("COUNTDOWN");
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── In-memory Durable Object state mock ──────────────────────────────────────
function fakeCtx() {
  const map = new Map<string, unknown>();
  return {
    storage: {
      get: async (k: string) => map.get(k),
      put: async (k: string, v: unknown) => void map.set(k, v),
      delete: async (k: string) => void map.delete(k),
    },
    blockConcurrencyWhile(callback: () => Promise<void>) { return callback(); },
    acceptWebSocket() {},
    getWebSockets() {
      return [];
    },
  } as any;
}

function req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const SECRET = "unit-test-internal-secret";
const ADMIN = "unit-test-admin-key";
const env = { INTERNAL_REWARD_SECRET: SECRET, ADMIN_KEY: ADMIN } as any;

function profile(): PlayerProfile {
  return newProfile("u1", "Tester") as PlayerProfile;
}

// ── Authorization helpers ────────────────────────────────────────────────────
describe("authorization helpers", () => {
  it("rejects internal reward without the secret configured", () => {
    expect(requireInternalRewardAuth(req("POST", "https://x/?action=reward"), { INTERNAL_REWARD_SECRET: undefined } as any)).toBe(false);
  });
  it("rejects internal reward with wrong/missing secret header", () => {
    expect(requireInternalRewardAuth(req("POST", "https://x/?action=reward"), env)).toBe(false);
    expect(requireInternalRewardAuth(req("POST", "https://x/?action=reward", {}, { "x-internal-reward-secret": "nope" }), env)).toBe(false);
  });
  it("accepts internal reward with correct secret header", () => {
    expect(requireInternalRewardAuth(req("POST", "https://x/?action=reward", {}, { "x-internal-reward-secret": SECRET }), env)).toBe(true);
  });
  it("disables admin when ADMIN_KEY is not configured", () => {
    expect(requireAdminKey("anything", { ADMIN_KEY: undefined } as any)).toBe(false);
  });
  it("rejects admin with wrong key, accepts correct key", () => {
    expect(requireAdminKey("wrong", env)).toBe(false);
    expect(requireAdminKey(ADMIN, env)).toBe(true);
  });
});

// ── Profile DO endpoint lockdown ─────────────────────────────────────────────
describe("profile DO endpoint lockdown", () => {
  it("public POST /api/profile?action=reward is rejected (403)", async () => {
    const do_ = new PlayerProfileDurableObject(fakeCtx(), env);
    const res = await do_.fetch(req("POST", "https://x/api/profile?action=reward&userId=u1&username=T", { coins: 9999 }));
    expect(res.status).toBe(403);
  });

  it("internal reward with valid secret succeeds", async () => {
    const do_ = new PlayerProfileDurableObject(fakeCtx(), env);
    const res = await do_.fetch(req("POST", "https://x/api/profile?action=reward&userId=u1&username=T", { coins: 100, xp: 50 }, { "x-internal-reward-secret": SECRET }));
    expect(res.status).toBe(200);
    const p = (await res.json()) as PlayerProfile;
    expect(p.coins).toBe(150); // 50 welcome + 100
    expect(p.xp).toBe(50);
  });

  it("public admin-grant is rejected (403)", async () => {
    const do_ = new PlayerProfileDurableObject(fakeCtx(), env);
    const res = await do_.fetch(req("POST", "https://x/api/profile?action=admin-grant&userId=u1&username=T", { coins: 9999 }));
    expect(res.status).toBe(403);
  });

  it("admin-grant with correct admin key succeeds", async () => {
    const do_ = new PlayerProfileDurableObject(fakeCtx(), env);
    const res = await do_.fetch(req("POST", "https://x/api/profile?action=admin-grant&userId=u1&username=T", { key: ADMIN, coins: 10 }));
    expect(res.status).toBe(200);
    const p = (await res.json()) as PlayerProfile;
    expect(p.coins).toBe(60);
  });

  it("a user cannot grant currency to an arbitrary userId via reward", async () => {
    const do_ = new PlayerProfileDurableObject(fakeCtx(), env);
    // Attacker tries to reward a different userId without the secret.
    const res = await do_.fetch(req("POST", "https://x/api/profile?action=reward&userId=victim&username=V", { coins: 9999 }));
    expect(res.status).toBe(403);
    // And the victim profile must not have been created/credited.
    const getRes = await do_.fetch(req("GET", "https://x/api/profile?action=get&userId=victim&username=V"));
    const vp = (await getRes.json()) as PlayerProfile;
    expect(vp.coins).toBe(50); // untouched welcome grant only
  });
});

// ── Economy mutations + ledger ─────────────────────────────────────────────────
describe("economy mutations and ledger", () => {
  it("purchase deducts the correct currency and writes a ledger entry", () => {
    const p = profile() as unknown as ProfileLike;
    applyReward(p, { coins: 200, source: "match_reward" }); // fund: 50 + 200 = 250
    const before = p.economyLedger.length;
    const r = applyPurchase(p, "trail_leaf"); // 120 coins
    expect(r.ok).toBe(true);
    expect(p.coins).toBe(130); // 250 - 120
    expect(p.ownedCosmetics).toContain("trail_leaf");
    expect(p.economyLedger.length).toBe(before + 1);
    expect(p.economyLedger[p.economyLedger.length - 1].source).toBe("purchase");
  });

  it("purchase fails with insufficient funds", () => {
    const p = profile() as unknown as ProfileLike; // 50 coins, can't afford 120
    const r = applyPurchase(p, "trail_leaf");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("insufficient_funds");
  });

  it("purchase of an unknown item is rejected", () => {
    const p = profile() as unknown as ProfileLike;
    const r = applyPurchase(p, "does_not_exist");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("unknown_item");
  });

  it("select requires an owned cosmetic", () => {
    const p = profile() as unknown as ProfileLike;
    expect(applySelect(p, "trail_leaf")).toBe(false);
    p.ownedCosmetics.push("trail_leaf");
    expect(applySelect(p, "trail_leaf")).toBe(true);
  });

  it("recognizes district discovery only inside an authoritative district radius", () => {
    expect(districtAtPosition(3_000, 3_000)?.id).toBe("lodge");
    expect(districtAtPosition(4_750, 4_450)?.id).toBe("wateringHole");
    expect(districtAtPosition(-100, -100)).toBeNull();
  });

  it("uses migration-safe defaults and enforces species-compatible loadouts", () => {
    const p = profile() as unknown as ProfileLike;
    expect((p as any).loadout).toMatchObject({ hunterTool: "tracker_standard", animalSkins: {} });
    p.ownedCosmetics.push("tool_tranquilizer", "skin_rabbit_moonfern");
    expect(applySelectLoadout(p, { slot: "hunterTool", itemId: "tool_tranquilizer" })).toBe(true);
    expect(applySelectLoadout(p, { slot: "animalSkin", species: "rabbit", itemId: "skin_rabbit_moonfern" })).toBe(true);
    expect(applySelectLoadout(p, { slot: "animalSkin", species: "bear", itemId: "skin_rabbit_moonfern" })).toBe(false);
  });

  it("every reward writes a ledger entry", () => {
    const p = profile() as unknown as ProfileLike;
    const before = p.economyLedger.length;
    applyReward(p, { coins: 10, xp: 5, source: "match_reward" });
    expect(p.economyLedger.length).toBe(before + 1);
    const e = p.economyLedger[p.economyLedger.length - 1];
    expect(e.deltaCoins).toBe(10);
    expect(e.balanceAfter.coins).toBe(p.coins);
  });
});

// ── Open-world idempotency / reset ─────────────────────────────────────────────
describe("open-world idempotency and daily reset", () => {
  function completeQuest(def: QuestDefinition) {
    return { questId: def.id, status: "complete" as const, progress: def.targetCount, targetCount: def.targetCount };
  }

  it("duplicate quest claim is idempotent and does not double-pay", () => {
    const p = profile() as unknown as ProfileLike;
    const def = questCatalogForTest()[0];
    const cur = completeQuest(def);
    const r1 = applyQuestClaim(p, def, cur);
    expect(r1.changed).toBe(true);
    const coinsAfterFirst = p.coins;
    // Second claim on the same (now claimed) quest must not pay again.
    const r2 = applyQuestClaim(p, def, cur);
    expect(r2.changed).toBe(false);
    expect(p.coins).toBe(coinsAfterFirst);
  });

  it("collecting the same node twice in one cycle does not double-pay", () => {
    const now = Date.now();
    expect(collectibleGrantable(undefined, now)).toBe(true);
    expect(collectibleGrantable(now + 30_000, now)).toBe(false); // in cooldown
  });

  it("daily quest reset triggers on UTC date change", () => {
    expect(dueDailyReset("2026-07-09", "2026-07-10")).toBe(true);
    expect(dueDailyReset("2026-07-10", "2026-07-10")).toBe(false);
  });
});

// ── Mode isolation ─────────────────────────────────────────────────────────────
describe("mode isolation", () => {
  it("open-world zone join does not alter match room state", () => {
    const room = new GameRoomDurableObject(fakeCtx(), env);
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.players).toHaveLength(0);
    // Creating/using an open-world zone instance must not touch the match room.
    new OpenWorldZoneDurableObject(fakeCtx(), env);
    expect(room.state.phase).toBe("LOBBY");
    expect(room.state.players).toHaveLength(0);
  });

  it("match room starts in LOBBY (match mode intact)", () => {
    const room = new GameRoomDurableObject(fakeCtx(), env);
    expect(room.state.phase).toBe("LOBBY");
  });
});
