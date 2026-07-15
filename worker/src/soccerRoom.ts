export type SoccerTeamId = "coral" | "teal";
export type SoccerRole = "keeper" | "midfielder" | "striker";
export type SoccerPhase = "kickoff" | "playing" | "goal" | "ended";

export interface SoccerVector { x: number; y: number }
export interface SoccerBallSnapshot extends SoccerVector { vx: number; vy: number; spin: number }
export interface SoccerPlayerSnapshot extends SoccerVector {
  id: string;
  username: string;
  team: SoccerTeamId;
  role: SoccerRole;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  isAi: boolean;
  energy: number;
  kickCooldownMs: number;
}
export interface SoccerMatchSnapshot {
  matchId: string;
  revision: number;
  phase: SoccerPhase;
  coralScore: number;
  tealScore: number;
  remainingMs: number;
  phaseRemainingMs: number;
  kickoffTeam: SoccerTeamId;
  lastScorerId?: string;
  lastTouchPlayerId?: string;
  ball: SoccerBallSnapshot;
  players: SoccerPlayerSnapshot[];
}

type SoccerCommand =
  | { type: "MOVE"; payload?: { x?: number; y?: number; sequence?: number; sprint?: boolean } }
  | { type: "KICK"; payload?: { target?: { x?: number; y?: number }; power?: number; sequence?: number } }
  | { type: "SELECT_TEAM"; payload?: { team?: SoccerTeamId } }
  | { type: "RESTART" };

interface ControllerState { move: SoccerVector; sprint: boolean; kick?: { target: SoccerVector; power: number }; sequence: number }
interface SoccerRoomEnv { ROOM_DIRECTORY: DurableObjectNamespace }

export const SOCCER_FIELD_WIDTH = 2_400;
export const SOCCER_FIELD_HEIGHT = 1_360;
export const SOCCER_GOAL_HALF_HEIGHT = 235;
export const SOCCER_PLAYER_RADIUS = 54;
export const SOCCER_BALL_RADIUS = 30;
const MATCH_DURATION_MS = 180_000;
const KICKOFF_MS = 2_000;
const GOAL_PAUSE_MS = 2_200;
const PLAYER_SPEED = 360;
const SPRINT_SPEED = 470;
const TICK_MS = 1000 / 30;

export function movementSpeedForPlayer(_player: Pick<SoccerPlayerSnapshot, "isAi">, sprinting: boolean): number {
  // Multiplayer is intentionally symmetric: team, role, and AI status never
  // alter the locomotion ceiling. The 8% human boost exists only in local
  // quick play where it makes a solo match feel responsive and forgiving.
  return sprinting ? SPRINT_SPEED : PLAYER_SPEED;
}

export function soccerGoalForBall(ball: SoccerBallSnapshot): SoccerTeamId | null {
  const inMouth = Math.abs(ball.y - SOCCER_FIELD_HEIGHT / 2) <= SOCCER_GOAL_HALF_HEIGHT;
  if (!inMouth) return null;
  if (ball.x > SOCCER_FIELD_WIDTH + SOCCER_BALL_RADIUS * 0.35) return "coral";
  if (ball.x < -SOCCER_BALL_RADIUS * 0.35) return "teal";
  return null;
}

export function advanceSoccerBall(ball: SoccerBallSnapshot, deltaSeconds: number): { ball: SoccerBallSnapshot; goal: SoccerTeamId | null } {
  const dt = clamp(deltaSeconds, 0, 0.1);
  const drag = Math.pow(0.985, dt * 60);
  const next = { ...ball, x: ball.x + ball.vx * dt, y: ball.y + ball.vy * dt, vx: ball.vx * drag, vy: ball.vy * drag, spin: ball.spin * Math.pow(0.97, dt * 60) };
  if (next.y < SOCCER_BALL_RADIUS) { next.y = SOCCER_BALL_RADIUS; next.vy = Math.abs(next.vy) * 0.78; }
  if (next.y > SOCCER_FIELD_HEIGHT - SOCCER_BALL_RADIUS) { next.y = SOCCER_FIELD_HEIGHT - SOCCER_BALL_RADIUS; next.vy = -Math.abs(next.vy) * 0.78; }
  const goal = soccerGoalForBall(next);
  if (!goal) {
    const outsideMouth = Math.abs(next.y - SOCCER_FIELD_HEIGHT / 2) > SOCCER_GOAL_HALF_HEIGHT;
    if (outsideMouth && next.x < SOCCER_BALL_RADIUS) { next.x = SOCCER_BALL_RADIUS; next.vx = Math.abs(next.vx) * 0.8; }
    if (outsideMouth && next.x > SOCCER_FIELD_WIDTH - SOCCER_BALL_RADIUS) { next.x = SOCCER_FIELD_WIDTH - SOCCER_BALL_RADIUS; next.vx = -Math.abs(next.vx) * 0.8; }
  }
  if (Math.hypot(next.vx, next.vy) < 3) { next.vx = 0; next.vy = 0; }
  return { ball: next, goal };
}

export class SoccerRoomDurableObject implements DurableObject {
  private snapshot: SoccerMatchSnapshot;
  private readonly sockets = new Set<WebSocket>();
  private readonly attachments = new WeakMap<WebSocket, { userId: string; username: string }>();
  private readonly controllers = new Map<string, ControllerState>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastAccumulator = 0;
  private directoryRoomId = "";
  private teamSize: 3 | 5 = 5;

  constructor(private readonly ctx: DurableObjectState, private readonly env: SoccerRoomEnv) {
    this.snapshot = createSoccerMatch("pending", this.teamSize);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const url = new URL(request.url);
    const roomId = url.searchParams.get("room")?.trim().toUpperCase() || crypto.randomUUID();
    const userId = cleanId(url.searchParams.get("userId")) || crypto.randomUUID();
    const username = cleanName(url.searchParams.get("username")) || "Player";
    const requestedTeam = url.searchParams.get("team") === "teal" ? "teal" : "coral";
    const requestedSize = Number(url.searchParams.get("teamSize")) === 3 ? 3 : 5;
    if (!this.directoryRoomId) {
      this.directoryRoomId = roomId;
      this.teamSize = requestedSize;
      this.snapshot = createSoccerMatch(roomId, requestedSize);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.add(server);
    this.attachments.set(server, { userId, username });
    server.addEventListener("message", (event) => this.webSocketMessage(server, event.data));
    server.addEventListener("close", () => this.webSocketClose(server));
    server.addEventListener("error", () => this.webSocketClose(server));
    this.addHuman(userId, username, requestedTeam);
    this.ensureTicking();
    this.sendSnapshot(server);
    void this.updateDirectory();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, frame: string | ArrayBuffer): void {
    const attachment = this.attachments.get(socket);
    if (!attachment || typeof frame !== "string" || frame.length > 4_096) return;
    let command: SoccerCommand;
    try { command = JSON.parse(frame) as SoccerCommand; } catch { return; }
    const player = this.snapshot.players.find((candidate) => candidate.id === attachment.userId && !candidate.isAi);
    if (!player) return;
    const previous = this.controllers.get(player.id) ?? { move: { x: 0, y: 0 }, sprint: false, sequence: -1 };

    if (command.type === "MOVE") {
      const sequence = finite(command.payload?.sequence, -1);
      if (sequence <= previous.sequence) return;
      const move = normalize({ x: finite(command.payload?.x, 0), y: finite(command.payload?.y, 0) });
      this.controllers.set(player.id, { ...previous, move, sprint: command.payload?.sprint === true, sequence });
    } else if (command.type === "KICK") {
      const targetX = finite(command.payload?.target?.x, player.x + player.facingX * 600);
      const targetY = finite(command.payload?.target?.y, player.y + player.facingY * 600);
      const power = clamp(finite(command.payload?.power, 0.8), 0.15, 1);
      this.controllers.set(player.id, { ...previous, kick: { target: { x: targetX, y: targetY }, power } });
    } else if (command.type === "SELECT_TEAM" && (command.payload?.team === "coral" || command.payload?.team === "teal")) {
      this.switchTeam(player, command.payload.team);
    } else if (command.type === "RESTART" && this.snapshot.phase === "ended") {
      const humans = this.snapshot.players.filter((candidate) => !candidate.isAi).map((candidate) => ({ id: candidate.id, username: candidate.username, team: candidate.team }));
      this.snapshot = createSoccerMatch(this.directoryRoomId, this.teamSize);
      for (const human of humans) this.addHuman(human.id, human.username, human.team);
    }
  }

  webSocketClose(socket: WebSocket, _code = 1000, _reason = "", _wasClean = true): void {
    const attachment = this.attachments.get(socket);
    this.sockets.delete(socket);
    if (attachment && ![...this.sockets].some((candidate) => this.attachments.get(candidate)?.userId === attachment.userId)) {
      this.replaceHumanWithAi(attachment.userId);
      this.controllers.delete(attachment.userId);
    }
    if (this.sockets.size === 0 && this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    void this.updateDirectory();
  }

  private addHuman(userId: string, username: string, preferredTeam: SoccerTeamId): void {
    const existing = this.snapshot.players.find((player) => player.id === userId);
    if (existing) { existing.isAi = false; existing.username = username; return; }
    const preferredSlot = this.snapshot.players.find((player) => player.team === preferredTeam && player.isAi);
    const fallbackSlot = this.snapshot.players.find((player) => player.isAi);
    const slot = preferredSlot ?? fallbackSlot;
    if (!slot) return;
    this.controllers.delete(slot.id);
    slot.id = userId;
    slot.username = username;
    slot.isAi = false;
  }

  private replaceHumanWithAi(userId: string): void {
    const player = this.snapshot.players.find((candidate) => candidate.id === userId);
    if (!player) return;
    player.id = `ai-${player.team}-${player.role}-${crypto.randomUUID().slice(0, 8)}`;
    player.username = aiName(player.role);
    player.isAi = true;
  }

  private switchTeam(player: SoccerPlayerSnapshot, team: SoccerTeamId): void {
    if (player.team === team) return;
    const swap = this.snapshot.players.find((candidate) => candidate.team === team && candidate.isAi && candidate.role === player.role)
      ?? this.snapshot.players.find((candidate) => candidate.team === team && candidate.isAi);
    if (!swap) return;
    const oldTeam = player.team;
    player.team = swap.team;
    player.role = swap.role;
    [player.x, player.y] = [swap.x, swap.y];
    swap.team = oldTeam;
    resetPlayerToFormation(swap, this.teamSize, this.snapshot.players.filter((candidate) => candidate.team === oldTeam).indexOf(swap));
  }

  private ensureTicking(): void {
    if (this.tickInterval) return;
    let previous = Date.now();
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const delta = clamp(now - previous, 0, 100);
      previous = now;
      this.step(delta);
      this.broadcastAccumulator += delta;
      if (this.broadcastAccumulator >= 1000 / 15) { this.broadcastAccumulator = 0; this.broadcast(); }
    }, TICK_MS);
  }

  private step(deltaMs: number): void {
    if (this.snapshot.phase === "ended") return;
    if (this.snapshot.phase === "kickoff" || this.snapshot.phase === "goal") {
      this.snapshot.phaseRemainingMs = Math.max(0, this.snapshot.phaseRemainingMs - deltaMs);
      if (this.snapshot.phaseRemainingMs === 0) {
        this.snapshot.phase = "playing";
        this.snapshot.ball = centerBall();
        resetAllFormations(this.snapshot.players, this.teamSize);
      }
    } else {
      this.snapshot.remainingMs = Math.max(0, this.snapshot.remainingMs - deltaMs);
      if (this.snapshot.remainingMs === 0) { this.snapshot.phase = "ended"; void this.updateDirectory(); }
    }

    if (this.snapshot.phase !== "playing") { this.snapshot.revision += 1; return; }
    const dt = deltaMs / 1000;
    for (const player of this.snapshot.players) this.advancePlayer(player, dt);
    this.resolveBallContacts();
    const advanced = advanceSoccerBall(this.snapshot.ball, dt);
    this.snapshot.ball = advanced.ball;
    if (advanced.goal) this.scoreGoal(advanced.goal);
    this.snapshot.revision += 1;
  }

  private advancePlayer(player: SoccerPlayerSnapshot, dt: number): void {
    let controller = this.controllers.get(player.id);
    if (player.isAi) controller = this.aiController(player);
    controller ??= { move: { x: 0, y: 0 }, sprint: false, sequence: 0 };
    const move = normalize(controller.move);
    const sprint = controller.sprint && player.energy > 0.05;
    const speed = movementSpeedForPlayer(player, sprint);
    player.vx = move.x * speed;
    player.vy = move.y * speed;
    player.x = clamp(player.x + player.vx * dt, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_WIDTH - SOCCER_PLAYER_RADIUS);
    player.y = clamp(player.y + player.vy * dt, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_HEIGHT - SOCCER_PLAYER_RADIUS);
    if (Math.hypot(player.vx, player.vy) > 4) { player.facingX = move.x; player.facingY = move.y; }
    player.energy = clamp(player.energy + (sprint ? -0.24 : 0.14) * dt, 0, 1);
    player.kickCooldownMs = Math.max(0, player.kickCooldownMs - dt * 1000);
  }

  private aiController(player: SoccerPlayerSnapshot): ControllerState {
    const attacksRight = player.team === "coral";
    const ownGoalX = attacksRight ? 80 : SOCCER_FIELD_WIDTH - 80;
    const distanceToBall = Math.hypot(this.snapshot.ball.x - player.x, this.snapshot.ball.y - player.y);
    let target: SoccerVector;
    if (player.role === "keeper") {
      target = { x: ownGoalX, y: clamp(this.snapshot.ball.y, SOCCER_FIELD_HEIGHT / 2 - 210, SOCCER_FIELD_HEIGHT / 2 + 210) };
    } else if (player.role === "striker" || distanceToBall < 420) {
      target = { x: this.snapshot.ball.x, y: this.snapshot.ball.y };
    } else {
      target = { x: this.snapshot.ball.x + (attacksRight ? -310 : 310), y: this.snapshot.ball.y + (player.y < SOCCER_FIELD_HEIGHT / 2 ? -170 : 170) };
    }
    const move = normalize({ x: target.x - player.x, y: target.y - player.y });
    const controller: ControllerState = { move, sprint: distanceToBall > 250 && player.role !== "keeper", sequence: this.snapshot.revision };
    if (distanceToBall < SOCCER_PLAYER_RADIUS + SOCCER_BALL_RADIUS + 28) {
      controller.kick = { target: { x: attacksRight ? SOCCER_FIELD_WIDTH + 130 : -130, y: SOCCER_FIELD_HEIGHT / 2 + (Math.random() - 0.5) * 240 }, power: player.role === "striker" ? 0.92 : 0.72 };
    }
    return controller;
  }

  private resolveBallContacts(): void {
    for (const player of this.snapshot.players) {
      const dx = this.snapshot.ball.x - player.x;
      const dy = this.snapshot.ball.y - player.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const contact = SOCCER_PLAYER_RADIUS + SOCCER_BALL_RADIUS;
      if (distance > contact + 12) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      this.snapshot.ball.x = player.x + nx * contact;
      this.snapshot.ball.y = player.y + ny * contact;
      this.snapshot.ball.vx += player.vx * 0.5 + nx * 55;
      this.snapshot.ball.vy += player.vy * 0.5 + ny * 55;
      this.snapshot.lastTouchPlayerId = player.id;
      const controller = player.isAi ? this.aiController(player) : this.controllers.get(player.id);
      if (controller?.kick && player.kickCooldownMs <= 0) {
        const direction = normalize({ x: controller.kick.target.x - this.snapshot.ball.x, y: controller.kick.target.y - this.snapshot.ball.y });
        const impulse = 820 + controller.kick.power * 720;
        this.snapshot.ball.vx = direction.x * impulse;
        this.snapshot.ball.vy = direction.y * impulse;
        this.snapshot.ball.spin = (direction.y * player.facingX - direction.x * player.facingY) * 0.6;
        player.kickCooldownMs = 420;
        controller.kick = undefined;
      }
    }
  }

  private scoreGoal(team: SoccerTeamId): void {
    if (team === "coral") this.snapshot.coralScore += 1; else this.snapshot.tealScore += 1;
    const scorer = this.snapshot.players.find((player) => player.id === this.snapshot.lastTouchPlayerId && player.team === team);
    this.snapshot.lastScorerId = scorer?.id;
    this.snapshot.phase = "goal";
    this.snapshot.phaseRemainingMs = GOAL_PAUSE_MS;
    this.snapshot.kickoffTeam = team === "coral" ? "teal" : "coral";
    this.snapshot.ball = centerBall();
  }

  private sendSnapshot(socket: WebSocket): void {
    try { socket.send(JSON.stringify({ type: "SOCCER_SNAPSHOT", payload: this.snapshot })); } catch { /* Socket closed. */ }
  }

  private broadcast(): void { for (const socket of this.sockets) this.sendSnapshot(socket); }

  private async updateDirectory(): Promise<void> {
    if (!this.directoryRoomId) return;
    const playerCount = new Set([...this.sockets].map((socket) => this.attachments.get(socket)?.userId).filter(Boolean)).size;
    // Soccer supports safe drop-in play. Keep the directory entry joinable
    // until the final whistle; the Durable Object replaces open slots with AI.
    const phase = this.snapshot.phase === "ended" ? "ENDED" : "LOBBY";
    try {
      const id = this.env.ROOM_DIRECTORY.idFromName("global-room-directory");
      await this.env.ROOM_DIRECTORY.get(id).fetch("https://directory/internal/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId: this.directoryRoomId, playerCount, phase }),
      });
    } catch { /* Directory status is best effort. */ }
  }
}

export function createSoccerMatch(matchId: string, teamSize: 3 | 5): SoccerMatchSnapshot {
  const players: SoccerPlayerSnapshot[] = [];
  for (const team of ["coral", "teal"] as const) {
    for (let index = 0; index < teamSize; index += 1) players.push(createAiPlayer(team, index, teamSize));
  }
  return { matchId, revision: 0, phase: "kickoff", coralScore: 0, tealScore: 0, remainingMs: MATCH_DURATION_MS, phaseRemainingMs: KICKOFF_MS, kickoffTeam: "coral", ball: centerBall(), players };
}

function createAiPlayer(team: SoccerTeamId, index: number, teamSize: 3 | 5): SoccerPlayerSnapshot {
  const role: SoccerRole = index === 0 ? "keeper" : index >= teamSize - 2 ? "striker" : "midfielder";
  const player: SoccerPlayerSnapshot = { id: `ai-${team}-${index}`, username: aiName(role), team, role, x: 0, y: 0, vx: 0, vy: 0, facingX: team === "coral" ? 1 : -1, facingY: 0, isAi: true, energy: 1, kickCooldownMs: 0 };
  resetPlayerToFormation(player, teamSize, index);
  return player;
}

function resetAllFormations(players: SoccerPlayerSnapshot[], teamSize: 3 | 5): void {
  for (const team of ["coral", "teal"] as const) players.filter((player) => player.team === team).forEach((player, index) => resetPlayerToFormation(player, teamSize, index));
}

function resetPlayerToFormation(player: SoccerPlayerSnapshot, teamSize: 3 | 5, index: number): void {
  const ratios = teamSize === 3 ? [[0.08, 0.5], [0.36, 0.5], [0.69, 0.5]] : [[0.08, 0.5], [0.32, 0.3], [0.32, 0.7], [0.65, 0.34], [0.65, 0.66]];
  const [xRatio, yRatio] = ratios[Math.max(0, Math.min(ratios.length - 1, index))];
  player.x = player.team === "coral" ? SOCCER_FIELD_WIDTH * xRatio : SOCCER_FIELD_WIDTH * (1 - xRatio);
  player.y = SOCCER_FIELD_HEIGHT * yRatio;
  player.vx = 0; player.vy = 0; player.energy = 1; player.kickCooldownMs = 0;
}

function centerBall(): SoccerBallSnapshot { return { x: SOCCER_FIELD_WIDTH / 2, y: SOCCER_FIELD_HEIGHT / 2, vx: 0, vy: 0, spin: 0 }; }
function aiName(role: SoccerRole): string { return role === "keeper" ? "Block Keeper" : role === "striker" ? "Dash Forward" : "Field Runner"; }
function normalize(vector: SoccerVector): SoccerVector { const length = Math.hypot(vector.x, vector.y); return length > 1 ? { x: vector.x / length, y: vector.y / length } : vector; }
function finite(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function cleanId(value: string | null): string { return (value ?? "").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96); }
function cleanName(value: string | null): string { return (value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24); }
