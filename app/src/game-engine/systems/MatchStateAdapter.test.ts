import { describe, expect, it } from "vitest";
import { MatchStateAdapter } from "./MatchStateAdapter";

describe("MatchStateAdapter", () => {
  it("separates the single local player from remotes", () => {
    const state = { phase: "PLAYING", players: [{ id: "a", isAlive: true, isHunter: false }, { id: "b", isAlive: true, isHunter: true }] } as never;
    const adapter = new MatchStateAdapter(state, "a");
    expect(adapter.localPlayer()?.id).toBe("a");
    expect(adapter.remotePlayers().map((player) => player.id)).toEqual(["b"]);
    expect(adapter.canSimulateLocal()).toBe(true);
  });
});
