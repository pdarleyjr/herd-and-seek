import { describe, expect, it } from "vitest";
import {
  BALL_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_HALF_HEIGHT,
  MATCH_DURATION_MS,
  advanceBall,
  applyKick,
  chooseAiIntent,
  createLocalMatchState,
  normalizeMove,
  remainingMatchMs,
} from "./rules";

describe("soccer movement rules", () => {
  it("normalizes diagonal input without increasing speed", () => {
    const movement = normalizeMove({ x: 1, y: 1 });

    expect(Math.hypot(movement.x, movement.y)).toBeCloseTo(1, 5);
  });

  it("turns non-finite input into a safe idle command", () => {
    expect(normalizeMove({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: 0, y: 0 });
  });
});

describe("soccer ball rules", () => {
  it("applies a capped kick toward the target", () => {
    const ball = applyKick(
      { x: 100, y: 100, vx: 0, vy: 0, spin: 0 },
      { x: 900, y: 100 },
      3,
    );

    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeCloseTo(0, 5);
    expect(ball.vx).toBeLessThanOrEqual(1_080);
  });

  it("bounces off a sideline and stays inside the pitch", () => {
    const result = advanceBall(
      { x: FIELD_WIDTH / 2, y: BALL_RADIUS + 1, vx: 0, vy: -500, spin: 0 },
      0.1,
    );

    expect(result.goal).toBeNull();
    expect(result.ball.y).toBeGreaterThanOrEqual(BALL_RADIUS);
    expect(result.ball.vy).toBeGreaterThan(0);
  });

  it("detects a clean goal through the mouth", () => {
    const result = advanceBall(
      { x: FIELD_WIDTH - BALL_RADIUS - 2, y: FIELD_HEIGHT / 2, vx: 700, vy: 0, spin: 0 },
      0.1,
    );

    expect(result.goal).toBe("coral");
  });

  it("rebounds off the end line outside the goal mouth", () => {
    const result = advanceBall(
      {
        x: FIELD_WIDTH - BALL_RADIUS - 2,
        y: FIELD_HEIGHT / 2 + GOAL_HALF_HEIGHT + 80,
        vx: 700,
        vy: 0,
        spin: 0,
      },
      0.1,
    );

    expect(result.goal).toBeNull();
    expect(result.ball.vx).toBeLessThan(0);
  });
});

describe("soccer match state", () => {
  it("starts a regulation local match with balanced teams and a three-minute clock", () => {
    const state = createLocalMatchState({
      localPlayerId: "player-1",
      localPlayerName: "Ranger",
      selectedTeam: "teal",
      teamSize: 5,
    });

    expect(state.remainingMs).toBe(MATCH_DURATION_MS);
    expect(state.players.filter((player) => player.team === "coral")).toHaveLength(5);
    expect(state.players.filter((player) => player.team === "teal")).toHaveLength(5);
    expect(state.players.find((player) => player.id === "player-1")?.team).toBe("teal");
  });

  it("derives remaining time from an external snapshot clock without going below zero", () => {
    expect(remainingMatchMs(50_000, 47_500)).toBe(2_500);
    expect(remainingMatchMs(50_000, 55_000)).toBe(0);
  });

  it("gives a nearby attacker a kick intent toward the opposing goal", () => {
    const state = createLocalMatchState({
      localPlayerId: "player-1",
      localPlayerName: "Ranger",
      selectedTeam: "coral",
      teamSize: 3,
    });
    const attacker = state.players.find((player) => player.isAi && player.team === "coral" && player.role === "striker");
    expect(attacker).toBeDefined();
    if (!attacker) return;
    const intent = chooseAiIntent({
      ...state,
      ball: { ...state.ball, x: attacker.x + 20, y: attacker.y },
    }, attacker);

    expect(intent.kickTarget?.x).toBeGreaterThan(attacker.x);
    expect(Math.hypot(intent.move.x, intent.move.y)).toBeLessThanOrEqual(1);
  });
});
