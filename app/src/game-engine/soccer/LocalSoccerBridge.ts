import {
  BALL_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_PAUSE_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPRINT_SPEED,
  advanceBall,
  applyKick,
  chooseAiIntent,
  clamp,
  createLocalMatchState,
  normalizeMove,
  resetFormation,
} from "./rules";
import type {
  LocalSoccerMatchOptions,
  SoccerBridge,
  SoccerCommand,
  SoccerMatchSnapshot,
  SoccerPlayerSnapshot,
  SoccerSnapshotListener,
  SoccerTeamId,
  SoccerVector,
} from "./types";

interface ControllerState {
  move: SoccerVector;
  sprint: boolean;
  kick?: { target: SoccerVector; power: number };
}

export const QUICK_PLAY_HUMAN_SPEED_MULTIPLIER = 1.08;

export function quickPlayMovementSpeed(isAi: boolean, sprinting: boolean): number {
  const base = sprinting ? SPRINT_SPEED : PLAYER_SPEED;
  return isAi ? base : base * QUICK_PLAY_HUMAN_SPEED_MULTIPLIER;
}

export class LocalSoccerBridge implements SoccerBridge {
  readonly localPlayerId: string;
  private snapshot: SoccerMatchSnapshot;
  private readonly listeners = new Set<SoccerSnapshotListener>();
  private readonly controllers = new Map<string, ControllerState>();
  private accumulatorMs = 0;

  constructor(options: LocalSoccerMatchOptions) {
    this.localPlayerId = options.localPlayerId;
    this.snapshot = createLocalMatchState(options);
  }

  getSnapshot(): SoccerMatchSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SoccerSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  send(command: SoccerCommand): void {
    if (command.type === "RESTART") {
      this.snapshot = createLocalMatchState({
        localPlayerId: this.localPlayerId,
        localPlayerName: this.snapshot.players.find((player) => player.id === this.localPlayerId)?.username ?? "Player",
        selectedTeam: this.snapshot.players.find((player) => player.id === this.localPlayerId)?.team ?? "coral",
        teamSize: this.snapshot.players.filter((player) => player.team === "coral").length as 3 | 5,
        matchId: this.snapshot.matchId,
      });
      this.publish();
      return;
    }
    if (command.type === "SELECT_TEAM") return;
    const previous = this.controllers.get(this.localPlayerId) ?? { move: { x: 0, y: 0 }, sprint: false };
    if (command.type === "MOVE") {
      this.controllers.set(this.localPlayerId, {
        ...previous,
        move: normalizeMove(command.payload),
        sprint: command.payload.sprint,
      });
    } else if (command.type === "KICK") {
      this.controllers.set(this.localPlayerId, {
        ...previous,
        kick: { target: command.payload.target, power: command.payload.power },
      });
    }
  }

  advance(deltaMs: number): void {
    this.accumulatorMs += clamp(deltaMs, 0, 100);
    const fixedMs = 1000 / 60;
    let stepped = false;
    while (this.accumulatorMs >= fixedMs) {
      this.accumulatorMs -= fixedMs;
      this.step(fixedMs);
      stepped = true;
    }
    if (stepped) this.publish();
  }

  destroy(): void {
    this.listeners.clear();
    this.controllers.clear();
  }

  private step(deltaMs: number): void {
    const dt = deltaMs / 1000;
    let state = this.snapshot;
    if (state.phase === "ended") return;

    if (state.phase === "kickoff") {
      const remaining = Math.max(0, state.phaseRemainingMs - deltaMs);
      state = { ...state, phaseRemainingMs: remaining };
      if (remaining === 0) state = { ...state, phase: "playing", phaseRemainingMs: 0 };
    } else if (state.phase === "goal") {
      const remaining = Math.max(0, state.phaseRemainingMs - deltaMs);
      state = { ...state, phaseRemainingMs: remaining };
      if (remaining === 0) state = resetFormation(state, state.kickoffTeam);
    } else {
      state = { ...state, remainingMs: Math.max(0, state.remainingMs - deltaMs) };
      if (state.remainingMs <= 0) {
        this.snapshot = { ...state, phase: "ended", phaseRemainingMs: 0, revision: state.revision + 1 };
        return;
      }
    }

    const active = state.phase === "playing";
    const players = state.players.map((player) => this.advancePlayer(state, player, active, dt));
    let ball = state.ball;
    let lastTouchPlayerId = state.lastTouchPlayerId;

    if (active) {
      for (const player of players) {
        const controller = this.controllers.get(player.id);
        const dx = ball.x - player.x;
        const dy = ball.y - player.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const contactDistance = PLAYER_RADIUS + BALL_RADIUS;
        if (distance > contactDistance + 14) continue;
        const direction = { x: dx / distance, y: dy / distance };
        ball = {
          ...ball,
          x: player.x + direction.x * contactDistance,
          y: player.y + direction.y * contactDistance,
          vx: ball.vx + player.vx * 0.5 + direction.x * 60,
          vy: ball.vy + player.vy * 0.5 + direction.y * 60,
        };
        lastTouchPlayerId = player.id;
        if (controller?.kick && player.kickCooldownMs <= 0) {
          ball = applyKick(ball, controller.kick.target, controller.kick.power);
          player.kickCooldownMs = 420;
          controller.kick = undefined;
        }
      }
      const advanced = advanceBall(ball, dt);
      ball = advanced.ball;
      if (advanced.goal) {
        const scorer = players.find((player) => player.id === lastTouchPlayerId && player.team === advanced.goal);
        state = {
          ...state,
          phase: "goal",
          phaseRemainingMs: GOAL_PAUSE_MS,
          kickoffTeam: oppositeTeam(advanced.goal),
          coralScore: state.coralScore + (advanced.goal === "coral" ? 1 : 0),
          tealScore: state.tealScore + (advanced.goal === "teal" ? 1 : 0),
          lastScorerId: scorer?.id,
        };
      }
    }

    this.snapshot = {
      ...state,
      revision: state.revision + 1,
      ball,
      players,
      lastTouchPlayerId,
    };
  }

  private advancePlayer(
    state: SoccerMatchSnapshot,
    player: SoccerPlayerSnapshot,
    active: boolean,
    dt: number,
  ): SoccerPlayerSnapshot {
    if (!active) return { ...player, vx: 0, vy: 0, kickCooldownMs: Math.max(0, player.kickCooldownMs - dt * 1000) };
    let controller = this.controllers.get(player.id);
    if (player.isAi) {
      const intent = chooseAiIntent(state, player);
      controller = { move: intent.move, sprint: intent.sprint };
      if (intent.kickTarget) controller.kick = { target: intent.kickTarget, power: intent.kickPower ?? 0.7 };
      this.controllers.set(player.id, controller);
    }
    controller ??= { move: { x: 0, y: 0 }, sprint: false };
    const movement = normalizeMove(controller.move);
    const sprinting = controller.sprint && player.energy > 0.04;
    const speed = quickPlayMovementSpeed(player.isAi, sprinting);
    const energy = clamp(player.energy + (sprinting ? -0.24 : 0.14) * dt, 0, 1);
    const vx = movement.x * speed;
    const vy = movement.y * speed;
    return {
      ...player,
      x: clamp(player.x + vx * dt, PLAYER_RADIUS + 12, FIELD_WIDTH - PLAYER_RADIUS - 12),
      y: clamp(player.y + vy * dt, PLAYER_RADIUS + 12, FIELD_HEIGHT - PLAYER_RADIUS - 12),
      vx,
      vy,
      facingX: Math.hypot(vx, vy) > 5 ? movement.x : player.facingX,
      facingY: Math.hypot(vx, vy) > 5 ? movement.y : player.facingY,
      energy,
      kickCooldownMs: Math.max(0, player.kickCooldownMs - dt * 1000),
    };
  }

  private publish(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

export function createLocalSoccerBridge(options: LocalSoccerMatchOptions): SoccerBridge {
  return new LocalSoccerBridge(options);
}

function oppositeTeam(team: SoccerTeamId): SoccerTeamId {
  return team === "coral" ? "teal" : "coral";
}
