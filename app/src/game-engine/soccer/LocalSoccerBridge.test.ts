import { describe, expect, it } from "vitest";
import { LocalSoccerBridge } from "./LocalSoccerBridge";

function createBridge(): LocalSoccerBridge {
  return new LocalSoccerBridge({
    localPlayerId: "captain",
    localPlayerName: "Ranger",
    selectedTeam: "coral",
    teamSize: 3,
    matchId: "test-cup",
  });
}

function advanceFrames(bridge: LocalSoccerBridge, frameCount: number): void {
  for (let frame = 0; frame < frameCount; frame += 1) bridge.advance(1000 / 60);
}

describe("LocalSoccerBridge", () => {
  it("moves from kickoff into live play and publishes monotonic revisions", () => {
    const bridge = createBridge();
    const revisions: number[] = [];
    bridge.subscribe((snapshot) => revisions.push(snapshot.revision));

    advanceFrames(bridge, 120);

    expect(bridge.getSnapshot().phase).toBe("playing");
    expect(revisions.at(-1)).toBeGreaterThan(revisions[0]);
  });

  it("applies local movement commands while the AI advances the ball", () => {
    const bridge = createBridge();
    advanceFrames(bridge, 120);
    const start = bridge.getSnapshot().players.find((player) => player.id === "captain");
    bridge.send({ type: "MOVE", payload: { x: 1, y: 0, sprint: true, sequence: 1 } });

    advanceFrames(bridge, 360);

    const state = bridge.getSnapshot();
    const captain = state.players.find((player) => player.id === "captain");
    expect(captain?.x).toBeGreaterThan(start?.x ?? 0);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeGreaterThan(0);
  });

  it("replays from a fresh regulation snapshot", () => {
    const bridge = createBridge();
    advanceFrames(bridge, 150);
    bridge.send({ type: "RESTART" });

    const restarted = bridge.getSnapshot();
    expect(restarted.phase).toBe("kickoff");
    expect(restarted.remainingMs).toBe(180_000);
    expect(restarted.coralScore).toBe(0);
    expect(restarted.tealScore).toBe(0);
  });
});
