export type AnimalType =
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake";
export type PerkType = "sprint" | "camouflage" | "none";
export type GamePhase = "LOBBY" | "PLAYING" | "ENDED";

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  animalType: AnimalType;
  isHunter: boolean;
  isReady: boolean;
  isAlive: boolean;
  perk: PerkType;
}

export interface NpcSeed {
  id: number;
  x: number;
  y: number;
  animalType: AnimalType;
}

interface RoomState {
  phase: GamePhase;
  players: PlayerState[];
  npcSeeds: NpcSeed[];
  hunterId: string | null;
  ammo: number;
  maxAmmo: number;
  timeRemaining: number;
  matchStartTime: number;
  winner: "hunter" | "animals" | null;
  eventLog: string[];
}

interface ClientMessage {
  type: "READY" | "SYNC" | "SHOOT" | "SELECT_ANIMAL" | "SELECT_PERK" | "RESTART";
  payload?: any;
}

interface ServerMessage {
  type: "SYNC_STATE" | "MATCH_START" | "HIT" | "GAME_OVER";
  payload: any;
}

const WORLD_SIZE = 2000;
const PLAYER_RADIUS = 32;
const MATCH_DURATION = 120;

const ALL_ANIMALS: AnimalType[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
];

function randomAnimal(): AnimalType {
  return ALL_ANIMALS[Math.floor(Math.random() * ALL_ANIMALS.length)];
}

function generateNpcSeeds(count: number): NpcSeed[] {
  const seeds: NpcSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      id: i,
      x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
      y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
      animalType: randomAnimal(),
    });
  }
  return seeds;
}

function npcCountForPlayers(playerCount: number): number {
  if (playerCount <= 2) return 45;
  return Math.min(80, 50 + playerCount * 8);
}

export class GameRoomDurableObject implements DurableObject {
  state: RoomState;
  syncInterval: ReturnType<typeof setInterval> | null = null;
  countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(public ctx: DurableObjectState) {
    this.state = {
      phase: "LOBBY",
      players: [],
      npcSeeds: [],
      hunterId: null,
      ammo: 0,
      maxAmmo: 0,
      timeRemaining: MATCH_DURATION,
      matchStartTime: 0,
      winner: null,
      eventLog: [],
    };
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || crypto.randomUUID();
    const username = url.searchParams.get("username") || "Anonymous";

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    server.serializeAttachment({ userId, username });

    this.addPlayer(userId, username);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string } | null;
    if (!attachment) return;
    const userId = attachment.userId;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message as string);
    } catch {
      return;
    }

    const player = this.state.players.find((p) => p.id === userId);
    if (!player) return;

    switch (parsed.type) {
      case "READY":
        player.isReady = parsed.payload?.isReady ?? !player.isReady;
        this.broadcastState();
        this.tryStartMatch();
        break;

      case "SELECT_ANIMAL":
        if (this.state.phase === "LOBBY") {
          player.animalType = parsed.payload?.animalType ?? player.animalType;
          this.broadcastState();
        }
        break;

      case "SELECT_PERK":
        if (this.state.phase === "LOBBY") {
          player.perk = parsed.payload?.perk ?? "none";
          this.broadcastState();
        }
        break;

      case "SYNC":
        if (this.state.phase === "PLAYING" && player.isAlive) {
          const { x, y } = parsed.payload || {};
          if (typeof x === "number" && typeof y === "number") {
            player.x = Math.max(0, Math.min(WORLD_SIZE, x));
            player.y = Math.max(0, Math.min(WORLD_SIZE, y));
          }
        }
        break;

      case "SHOOT":
        if (this.state.phase === "PLAYING" && player.isHunter) {
          this.handleShoot(parsed.payload);
        }
        break;

      case "RESTART":
        if (this.state.phase === "ENDED") {
          this.resetRoom();
          this.broadcastState();
        }
        break;
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string } | null;
    if (!attachment) return;
    const userId = attachment.userId;

    this.removePlayer(userId);

    if (this.state.players.length === 0) {
      this.stopLoops();
    }
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    const attachment = ws.deserializeAttachment() as { userId: string; username: string } | null;
    if (!attachment) return;
    const userId = attachment.userId;
    this.removePlayer(userId);
  }

  addPlayer(id: string, username: string) {
    const existing = this.state.players.find((p) => p.id === id);
    if (!existing) {
      this.state.players.push({
        id,
        username,
        x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        animalType: randomAnimal(),
        isHunter: false,
        isReady: false,
        isAlive: true,
        perk: "none",
      });
    } else {
      existing.isAlive = true;
      existing.isReady = false;
    }
    this.broadcastState();
  }

  removePlayer(id: string) {
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (this.state.phase === "PLAYING") {
      if (this.state.hunterId === id) {
        this.endGame("animals", "Hunter disconnected!");
      } else if (this.state.players.length < 2) {
        this.endGame("animals", "Not enough players to continue!");
      } else {
        this.checkWinCondition();
      }
    }
    this.broadcastState();
  }

  tryStartMatch() {
    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.length < 2) return;
    if (!this.state.players.every((p) => p.isReady)) return;

    const players = this.state.players;
    const hunterIndex = Math.floor(Math.random() * players.length);
    const hunterId = players[hunterIndex].id;

    players.forEach((p, i) => {
      p.isHunter = i === hunterIndex;
      p.isAlive = true;
      p.isReady = false;
      p.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
      p.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
    });

    this.state.hunterId = hunterId;
    const animalCount = players.length - 1;
    this.state.ammo = animalCount * 10;
    this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = MATCH_DURATION;
    this.state.matchStartTime = Date.now();
    this.state.winner = null;
    this.state.eventLog = [`Match started! ${animalCount} animal(s) hiding.`];

    this.startSyncLoop();
    this.startCountdown();

    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
  }

  handleShoot(payload: any) {
    if (this.state.phase !== "PLAYING") return;
    const { targetX, targetY } = payload || {};
    if (typeof targetX !== "number" || typeof targetY !== "number") return;
    if (this.state.ammo <= 0) return;

    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) {
      if (p.isHunter || !p.isAlive) continue;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= PLAYER_RADIUS) {
        hitPlayer = p;
        break;
      }
    }

    if (hitPlayer) {
      hitPlayer.isAlive = false;
      this.state.eventLog.unshift(`${hitPlayer.username} was neutralized!`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.broadcast({
        type: "HIT",
        payload: { targetId: hitPlayer.id, targetX, targetY, hit: true },
      });
      this.checkWinCondition();
    } else {
      this.state.ammo -= 1;
      this.state.eventLog.unshift(`Hunter missed! ${this.state.ammo} ammo left.`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.broadcast({
        type: "HIT",
        payload: { targetId: null, targetX, targetY, hit: false },
      });
      if (this.state.ammo <= 0) {
        this.endGame("animals", "Hunter ran out of ammo!");
      }
    }
  }

  checkWinCondition() {
    const aliveAnimals = this.state.players.filter(
      (p) => !p.isHunter && p.isAlive
    );
    if (aliveAnimals.length === 0) {
      this.endGame("hunter", "All animals neutralized!");
    }
  }

  endGame(winner: "hunter" | "animals", reason: string) {
    if (this.state.phase === "ENDED") return;
    this.state.phase = "ENDED";
    this.state.winner = winner;
    this.state.timeRemaining = 0;
    this.state.eventLog.unshift(`Game Over: ${reason}`);
    this.state.eventLog = this.state.eventLog.slice(0, 10);
    this.stopLoops();
    this.broadcast({
      type: "GAME_OVER",
      payload: { winner, reason, state: this.serializeState() },
    });
  }

  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.state.phase === "PLAYING") {
        this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
      }
    }, 1000 / 30);
  }

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      if (this.state.phase !== "PLAYING") return;
      const elapsed = (Date.now() - this.state.matchStartTime) / 1000;
      if (elapsed >= MATCH_DURATION) {
        this.state.timeRemaining = 0;
        this.endGame("animals", "Time expired! Animals survived!");
        return;
      }
      this.state.timeRemaining = MATCH_DURATION - Math.floor(elapsed);
    }, 250);
  }

  stopLoops() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  resetRoom() {
    this.stopLoops();
    this.state.phase = "LOBBY";
    this.state.hunterId = null;
    this.state.ammo = 0;
    this.state.maxAmmo = 0;
    this.state.timeRemaining = MATCH_DURATION;
    this.state.winner = null;
    this.state.npcSeeds = [];
    this.state.eventLog = [];
    this.state.players.forEach((p) => {
      p.isHunter = false;
      p.isReady = false;
      p.isAlive = true;
      p.perk = "none";
    });
  }

  serializeState() {
    return {
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id,
        username: p.username,
        x: p.x,
        y: p.y,
        animalType: p.animalType,
        isHunter: p.isHunter,
        isReady: p.isReady,
        isAlive: p.isAlive,
        perk: p.perk,
      })),
      npcSeeds: this.state.npcSeeds,
      hunterId: this.state.hunterId,
      ammo: this.state.ammo,
      maxAmmo: this.state.maxAmmo,
      timeRemaining: this.state.timeRemaining,
      winner: this.state.winner,
      eventLog: this.state.eventLog,
    };
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    const wsList = this.ctx.getWebSockets();
    for (const ws of wsList) {
      try {
        ws.send(data);
      } catch {
        // connection may be closed
      }
    }
  }

  broadcastState() {
    this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
  }
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("room") || "lobby";

    const id = env.GAME_ROOM.idFromName(roomId);
    const stub = env.GAME_ROOM.get(id);

    return stub.fetch(request);
  },
};
