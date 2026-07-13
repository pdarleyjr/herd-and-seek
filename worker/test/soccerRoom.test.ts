import { describe, expect, it } from "vitest";
import {
  SOCCER_BALL_RADIUS,
  SOCCER_FIELD_HEIGHT,
  SOCCER_FIELD_WIDTH,
  advanceSoccerBall,
  createSoccerMatch,
  soccerGoalForBall,
} from "../src/soccerRoom";

describe("authoritative soccer rules", () => {
  it("creates balanced 3v3 and 5v5 formations", () => {
    for (const size of [3, 5] as const) {
      const match = createSoccerMatch("room", size);
      expect(match.players.filter((player) => player.team === "coral")).toHaveLength(size);
      expect(match.players.filter((player) => player.team === "teal")).toHaveLength(size);
      expect(match.players.every((player) => player.isAi)).toBe(true);
    }
  });

  it("scores only through the goal mouth", () => {
    expect(soccerGoalForBall({ x: SOCCER_FIELD_WIDTH + SOCCER_BALL_RADIUS, y: SOCCER_FIELD_HEIGHT / 2, vx: 10, vy: 0, spin: 0 })).toBe("coral");
    expect(soccerGoalForBall({ x: -SOCCER_BALL_RADIUS, y: SOCCER_FIELD_HEIGHT / 2, vx: -10, vy: 0, spin: 0 })).toBe("teal");
    expect(soccerGoalForBall({ x: SOCCER_FIELD_WIDTH + SOCCER_BALL_RADIUS, y: 40, vx: 10, vy: 0, spin: 0 })).toBeNull();
  });

  it("applies drag and rebounds from touchlines", () => {
    const result = advanceSoccerBall({ x: 400, y: 10, vx: 500, vy: -300, spin: 0.5 }, 1 / 30);
    expect(result.ball.y).toBe(SOCCER_BALL_RADIUS);
    expect(result.ball.vy).toBeGreaterThan(0);
    expect(result.ball.vx).toBeLessThan(500);
  });
});
