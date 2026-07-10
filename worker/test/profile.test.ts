import { describe, it, expect } from "vitest";
import {
  newProfile,
  applyReward,
  applyPurchase,
  applySelect,
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
  QUEST_CATALOG,
  type PlayerProfile,
  type QuestDefinition,
} from "../src/index";

// ── In-memory Durable Object state mock ──────────────────────────────────────
function fakeCtx() {
  const map = new Map<string, unknown>();
  return {
    storage: {
      get: async (k: string) => map.get(k),
      put: async (k: string, v: unknown) => void map.set(k, v),
      delete: async (k: string) => void map.delete(k),
    },
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
    const def = QUEST_CATALOG[0];
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
