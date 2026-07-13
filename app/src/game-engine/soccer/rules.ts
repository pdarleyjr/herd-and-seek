import type {
  LocalSoccerMatchOptions,
  SoccerAiIntent,
  SoccerBallSnapshot,
  SoccerMatchSnapshot,
  SoccerPlayerSnapshot,
  SoccerTeamId,
  SoccerVector,
} from "./types";

export const FIELD_WIDTH = 2_400;
export const FIELD_HEIGHT = 1_360;
export const GOAL_HALF_HEIGHT = 220;
export const GOAL_DEPTH = 86;
export const BALL_RADIUS = 24;
export const PLAYER_RADIUS = 42;
export const MATCH_DURATION_MS = 180_000;
export const KICKOFF_DURATION_MS = 1_800;
export const GOAL_PAUSE_MS = 2_400;
export const PLAYER_SPEED = 330;
export const SPRINT_SPEED = 430;
export const BALL_MAX_SPEED = 1_080;

const BALL_FRICTION_PER_SECOND = 1.54;
const BOUNCE_RESTITUTION = 0.74;

export interface BallAdvanceResult {
  ball: SoccerBallSnapshot;
  goal: SoccerTeamId | null;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeMove(vector: SoccerVector): SoccerVector {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return { x: 0, y: 0 };
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.0001) return { x: 0, y: 0 };
  if (length <= 1) return { x: vector.x, y: vector.y };
  return { x: vector.x / length, y: vector.y / length };
}

export function remainingMatchMs(endsAt: number, now: number): number {
  return Math.max(0, Math.round(endsAt - now));
}

export function applyKick(ball: SoccerBallSnapshot, target: SoccerVector, power: number): SoccerBallSnapshot {
  const direction = normalizeMove({ x: target.x - ball.x, y: target.y - ball.y });
  const impulse = clamp(Number.isFinite(power) ? power : 0, 0.15, 1) * BALL_MAX_SPEED;
  const cross = direction.x * ball.vy - direction.y * ball.vx;
  return {
    ...ball,
    vx: direction.x * impulse,
    vy: direction.y * impulse,
    spin: clamp(cross / 700, -1, 1),
  };
}

export function advanceBall(ball: SoccerBallSnapshot, deltaSeconds: number): BallAdvanceResult {
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1);
  const drag = Math.exp(-BALL_FRICTION_PER_SECOND * dt);
  const next: SoccerBallSnapshot = {
    x: ball.x + ball.vx * dt,
    y: ball.y + ball.vy * dt,
    vx: ball.vx * drag,
    vy: ball.vy * drag,
    spin: ball.spin * Math.exp(-2.2 * dt),
  };

  if (next.y < BALL_RADIUS) {
    next.y = BALL_RADIUS;
    next.vy = Math.abs(next.vy) * BOUNCE_RESTITUTION;
  } else if (next.y > FIELD_HEIGHT - BALL_RADIUS) {
    next.y = FIELD_HEIGHT - BALL_RADIUS;
    next.vy = -Math.abs(next.vy) * BOUNCE_RESTITUTION;
  }

  const inGoalMouth = Math.abs(next.y - FIELD_HEIGHT / 2) <= GOAL_HALF_HEIGHT - BALL_RADIUS * 0.25;
  if (next.x < BALL_RADIUS) {
    if (inGoalMouth) return { ball: next, goal: "teal" };
    next.x = BALL_RADIUS;
    next.vx = Math.abs(next.vx) * BOUNCE_RESTITUTION;
  } else if (next.x > FIELD_WIDTH - BALL_RADIUS) {
    if (inGoalMouth) return { ball: next, goal: "coral" };
    next.x = FIELD_WIDTH - BALL_RADIUS;
    next.vx = -Math.abs(next.vx) * BOUNCE_RESTITUTION;
  }

  if (Math.hypot(next.vx, next.vy) < 4) {
    next.vx = 0;
    next.vy = 0;
  }
  return { ball: next, goal: null };
}

export function createLocalMatchState(options: LocalSoccerMatchOptions): SoccerMatchSnapshot {
  const teamSize = options.teamSize;
  const players: SoccerPlayerSnapshot[] = [];
  const teamNames: Record<SoccerTeamId, string[]> = {
    coral: ["Mika", "Pip", "Nova", "Roo", "Ember"],
    teal: ["Finn", "Tala", "Moss", "Kito", "Skye"],
  };

  for (const team of ["coral", "teal"] as const) {
    for (let index = 0; index < teamSize; index += 1) {
      const isLocal = team === options.selectedTeam && index === Math.min(1, teamSize - 1);
      players.push(createFormationPlayer({
        id: isLocal ? options.localPlayerId : `${team}-bot-${index + 1}`,
        username: isLocal ? options.localPlayerName : teamNames[team][index],
        team,
        index,
        teamSize,
        isAi: !isLocal,
      }));
    }
  }

  return {
    matchId: options.matchId ?? `local-${options.selectedTeam}-${teamSize}`,
    revision: 0,
    phase: "kickoff",
    coralScore: 0,
    tealScore: 0,
    remainingMs: MATCH_DURATION_MS,
    phaseRemainingMs: KICKOFF_DURATION_MS,
    kickoffTeam: "coral",
    ball: centerBall(),
    players,
  };
}

export function resetFormation(snapshot: SoccerMatchSnapshot, kickoffTeam: SoccerTeamId): SoccerMatchSnapshot {
  const counts = {
    coral: snapshot.players.filter((player) => player.team === "coral").length,
    teal: snapshot.players.filter((player) => player.team === "teal").length,
  };
  const offsets = { coral: 0, teal: 0 };
  const players = snapshot.players.map((player) => {
    const index = offsets[player.team]++;
    const formed = createFormationPlayer({
      id: player.id,
      username: player.username,
      team: player.team,
      index,
      teamSize: counts[player.team],
      isAi: player.isAi,
    });
    return { ...formed, energy: player.energy };
  });
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    phase: "kickoff",
    phaseRemainingMs: KICKOFF_DURATION_MS,
    kickoffTeam,
    lastTouchPlayerId: undefined,
    ball: centerBall(),
    players,
  };
}

export function chooseAiIntent(snapshot: SoccerMatchSnapshot, player: SoccerPlayerSnapshot): SoccerAiIntent {
  const attacksRight = player.team === "coral";
  const ownGoal = { x: attacksRight ? 95 : FIELD_WIDTH - 95, y: FIELD_HEIGHT / 2 };
  const opposingGoal = { x: attacksRight ? FIELD_WIDTH + GOAL_DEPTH : -GOAL_DEPTH, y: FIELD_HEIGHT / 2 };
  const teammates = snapshot.players.filter((candidate) => candidate.team === player.team && candidate.role !== "keeper");
  const nearest = teammates.reduce((best, candidate) =>
    distanceSquared(candidate, snapshot.ball) < distanceSquared(best, snapshot.ball) ? candidate : best, teammates[0] ?? player);
  const ballDistance = Math.hypot(snapshot.ball.x - player.x, snapshot.ball.y - player.y);

  let target: SoccerVector;
  if (player.role === "keeper") {
    const danger = attacksRight ? snapshot.ball.x < FIELD_WIDTH * 0.3 : snapshot.ball.x > FIELD_WIDTH * 0.7;
    target = danger
      ? { x: ownGoal.x + (attacksRight ? 80 : -80), y: clamp(snapshot.ball.y, FIELD_HEIGHT / 2 - 170, FIELD_HEIGHT / 2 + 170) }
      : ownGoal;
  } else if (nearest.id === player.id || player.role === "striker") {
    target = { x: snapshot.ball.x - (attacksRight ? 42 : -42), y: snapshot.ball.y };
  } else {
    const lane = player.y < FIELD_HEIGHT / 2 ? FIELD_HEIGHT * 0.28 : FIELD_HEIGHT * 0.72;
    target = {
      x: clamp(snapshot.ball.x + (attacksRight ? -260 : 260), FIELD_WIDTH * 0.2, FIELD_WIDTH * 0.8),
      y: lane,
    };
  }

  const move = normalizeMove({ x: target.x - player.x, y: target.y - player.y });
  const shouldKick = ballDistance <= PLAYER_RADIUS + BALL_RADIUS + 18 && player.kickCooldownMs <= 0;
  return {
    move,
    kickTarget: shouldKick ? {
      x: opposingGoal.x,
      y: opposingGoal.y + Math.sin(hashString(player.id) + snapshot.revision * 0.13) * 115,
    } : undefined,
    kickPower: shouldKick ? (player.role === "keeper" ? 0.82 : 0.72) : undefined,
    sprint: player.role !== "keeper" && ballDistance > 280 && player.energy > 0.22,
  };
}

export function centerBall(): SoccerBallSnapshot {
  return { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, spin: 0 };
}

function createFormationPlayer(input: {
  id: string;
  username: string;
  team: SoccerTeamId;
  index: number;
  teamSize: number;
  isAi: boolean;
}): SoccerPlayerSnapshot {
  const attacksRight = input.team === "coral";
  const xSlots = input.teamSize === 3 ? [0.12, 0.31, 0.4] : [0.1, 0.28, 0.28, 0.41, 0.41];
  const ySlots = input.teamSize === 3 ? [0.5, 0.34, 0.66] : [0.5, 0.25, 0.75, 0.36, 0.64];
  const xRatio = xSlots[input.index] ?? 0.35;
  return {
    id: input.id,
    username: input.username.slice(0, 18),
    team: input.team,
    role: input.index === 0 ? "keeper" : input.index >= input.teamSize - 2 ? "striker" : "midfielder",
    x: attacksRight ? FIELD_WIDTH * xRatio : FIELD_WIDTH * (1 - xRatio),
    y: FIELD_HEIGHT * (ySlots[input.index] ?? 0.5),
    vx: 0,
    vy: 0,
    facingX: attacksRight ? 1 : -1,
    facingY: 0,
    isAi: input.isAi,
    energy: 1,
    kickCooldownMs: 0,
  };
}

function distanceSquared(a: SoccerVector, b: SoccerVector): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return hash * 0.001;
}
