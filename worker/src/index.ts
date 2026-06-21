export type AnimalType =
  | "elephant" | "penguin" | "monkey" | "giraffe"
  | "bear" | "dog" | "frog" | "horse"
  | "pig" | "rabbit" | "cow" | "duck"
  | "panda" | "parrot" | "owl" | "snake";
export type PerkType = "sprint" | "camouflage" | "extraLife" | "decoy" | "speedBoost" | "none";
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
  extraLifeUsed: boolean;
  // Bot / AI fields (undefined for human players)
  isBot?: boolean;
  botVx?: number;
  botVy?: number;
  botLastDecision?: number;
  botLastShot?: number;
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
  matchDuration: number;
  matchStartTime: number;
  winner: "hunter" | "animals" | null;
  eventLog: string[];
  isSoloMode: boolean;
}

interface ClientMessage {
  type: "READY" | "SYNC" | "SHOOT" | "SELECT_ANIMAL" | "SELECT_PERK" | "RESTART" | "DECOY" | "SET_DURATION" | "START_SOLO";
  payload?: any;
}

interface ServerMessage {
  type: "SYNC_STATE" | "MATCH_START" | "HIT" | "GAME_OVER" | "DECOY_SPAWN";
  payload: any;
}

const WORLD_SIZE = 2000;
const PLAYER_COLLISION_RADIUS = 34;
const MATCH_DURATION_DEFAULT = 120;
const MATCH_DURATION_MIN = 30;
const MATCH_DURATION_MAX = 3600;

const ALL_ANIMALS: AnimalType[] = [
  "elephant", "penguin", "monkey", "giraffe",
  "bear", "dog", "frog", "horse",
  "pig", "rabbit", "cow", "duck",
  "panda", "parrot", "owl", "snake",
];

function randomAnimal(): AnimalType {
  return ALL_ANIMALS[Math.floor(Math.random() * ALL_ANIMALS.length)];
}

function randomAnimalExcept(current: AnimalType): AnimalType {
  const available = ALL_ANIMALS.filter(a => a !== current);
  return available[Math.floor(Math.random() * available.length)];
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
      timeRemaining: MATCH_DURATION_DEFAULT,
      matchDuration: MATCH_DURATION_DEFAULT,
      matchStartTime: 0,
      winner: null,
      eventLog: [],
      isSoloMode: false,
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

      case "DECOY":
        if (this.state.phase === "PLAYING" && player.isAlive && !player.isHunter && player.perk === "decoy") {
          this.broadcast({
            type: "DECOY_SPAWN",
            payload: { x: player.x, y: player.y, animalType: player.animalType, ownerId: userId },
          });
        }
        break;

      case "START_SOLO":
        if (this.state.phase === "LOBBY" && !player.isBot) {
          // If no role specified (or "random"), server randomly assigns hunter/animal
          let role: "hunter" | "animal";
          if (parsed.payload?.role === "hunter") role = "hunter";
          else if (parsed.payload?.role === "animal") role = "animal";
          else role = Math.random() < 0.5 ? "hunter" : "animal";
          this.startSoloMatch(userId, role);
        }
        break;

      case "SET_DURATION":
        if (this.state.phase === "LOBBY") {
          const raw = parsed.payload?.duration;
          if (typeof raw === "number") {
            const clamped = Math.max(MATCH_DURATION_MIN, Math.min(MATCH_DURATION_MAX, Math.round(raw)));
            this.state.matchDuration = clamped;
            this.state.timeRemaining = clamped;
            this.broadcastState();
          }
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
        extraLifeUsed: false,
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
      p.extraLifeUsed = false;
      p.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
      p.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
    });

    this.state.hunterId = hunterId;
    const animalCount = players.length - 1;
    this.state.ammo = animalCount * 10;
    this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = this.state.matchDuration;
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
      if (dist <= PLAYER_COLLISION_RADIUS) {
        hitPlayer = p;
        break;
      }
    }

    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife") {
        const previousAnimal = hitPlayer.animalType;
        hitPlayer.animalType = randomAnimalExcept(previousAnimal);
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.perk = "none";
        hitPlayer.extraLifeUsed = true;
        this.state.eventLog.unshift(`${hitPlayer.username}'s Extra Life activated! Respawned as ${hitPlayer.animalType}.`);
        this.state.eventLog = this.state.eventLog.slice(0, 8);
this.broadcast({
           type: "HIT",
           payload: { targetId: hitPlayer.id, targetX, targetY, hit: true, extraLife: true, animalType: hitPlayer.animalType, x: hitPlayer.x, y: hitPlayer.y },
         });
        return;
      }
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
    setTimeout(() => {
      this.resetRoom();
      this.broadcastState();
    }, 5000);
  }

  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    let lastBotTick = 0;
    this.syncInterval = setInterval(() => {
      if (this.state.phase === "PLAYING") {
        const now = Date.now();
        // Update bots every 50 ms (independent of 30 Hz broadcast)
        if (this.state.isSoloMode && now - lastBotTick >= 50) {
          lastBotTick = now;
          this.updateBots(now);
        }
        this.broadcast({ type: "SYNC_STATE", payload: this.serializeState() });
      }
    }, 1000 / 30);
  }

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      if (this.state.phase !== "PLAYING") return;
      const elapsed = (Date.now() - this.state.matchStartTime) / 1000;
      if (elapsed >= this.state.matchDuration) {
        this.state.timeRemaining = 0;
        this.endGame("animals", "Time expired! Animals survived!");
        return;
      }
      this.state.timeRemaining = this.state.matchDuration - Math.floor(elapsed);
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
    this.state.timeRemaining = this.state.matchDuration;
    this.state.winner = null;
    this.state.npcSeeds = [];
    this.state.eventLog = [];
    this.state.isSoloMode = false;
    // Remove bot players; reset human players
    this.state.players = this.state.players.filter((p) => !p.isBot);
    this.state.players.forEach((p) => {
      p.isHunter = false;
      p.isReady = false;
      p.isAlive = true;
      p.perk = "none";
      p.extraLifeUsed = false;
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
        extraLifeUsed: p.extraLifeUsed,
        isBot: p.isBot ?? false,
      })),
      npcSeeds: this.state.npcSeeds,
      hunterId: this.state.hunterId,
      ammo: this.state.ammo,
      maxAmmo: this.state.maxAmmo,
      timeRemaining: this.state.timeRemaining,
      matchDuration: this.state.matchDuration,
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

  // ── Solo / Bot system ─────────────────────────────────────────────────────

  startSoloMatch(humanId: string, humanRole: "hunter" | "animal") {
    if (this.state.phase !== "LOBBY") return;
    const human = this.state.players.find((p) => p.id === humanId);
    if (!human) return;

    // Remove any leftover bots
    this.state.players = this.state.players.filter((p) => !p.isBot);

    const BOT_ANIMAL_TYPES: AnimalType[] = ["elephant", "monkey", "giraffe", "bear", "pig"];

    if (humanRole === "hunter") {
      human.isHunter = true;
      // Spawn 4 bot animals
      for (let i = 0; i < 4; i++) {
        this.state.players.push({
          id: `bot_animal_${i}_${Date.now()}`,
          username: `Animal ${i + 1}`,
          x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
          animalType: BOT_ANIMAL_TYPES[i % BOT_ANIMAL_TYPES.length],
          isHunter: false,
          isReady: true,
          isAlive: true,
          perk: "none",
          extraLifeUsed: false,
          isBot: true,
          botVx: (Math.random() - 0.5) * 5,
          botVy: (Math.random() - 0.5) * 5,
          botLastDecision: 0,
          botLastShot: 0,
        });
      }
      this.state.hunterId = human.id;
    } else {
      human.isHunter = false;
      // Spawn 1 bot hunter
      const botId = `bot_hunter_${Date.now()}`;
      this.state.players.push({
        id: botId,
        username: "🤖 AI Hunter",
        x: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
        y: Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150,
        animalType: "elephant",
        isHunter: true,
        isReady: true,
        isAlive: true,
        perk: "none",
        extraLifeUsed: false,
        isBot: true,
        botVx: 0,
        botVy: 0,
        botLastDecision: 0,
        botLastShot: 0,
      });
      this.state.hunterId = botId;
    }

    // Reset human player for the match
    human.isAlive = true;
    human.isReady = false;
    human.extraLifeUsed = false;
    human.x = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150;
    human.y = Math.floor(Math.random() * (WORLD_SIZE - 300)) + 150;

    const animalCount = this.state.players.filter((p) => !p.isHunter).length;
    this.state.ammo = animalCount * 10;
    this.state.maxAmmo = animalCount * 10;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(this.state.players.length));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = this.state.matchDuration;
    this.state.matchStartTime = Date.now();
    this.state.winner = null;
    this.state.isSoloMode = true;
    this.state.eventLog = [
      humanRole === "hunter"
        ? `Solo practice: You are the Hunter. Find the 4 AI animals!`
        : `Solo practice: You are an Animal. Survive the AI Hunter!`,
    ];

    this.startSyncLoop();
    this.startCountdown();
    this.broadcast({ type: "MATCH_START", payload: this.serializeState() });
  }

  updateBots(nowMs: number) {
    for (const p of this.state.players) {
      if (!p.isBot || !p.isAlive) continue;
      if (p.isHunter) {
        this.updateBotHunter(p, nowMs);
      } else {
        this.updateBotAnimal(p, nowMs);
      }
    }
  }

  updateBotAnimal(bot: PlayerState, nowMs: number) {
    const lastDecision = bot.botLastDecision ?? 0;
    // Change direction every 2–4 seconds
    if (nowMs - lastDecision > 2000 + Math.random() * 2000) {
      bot.botLastDecision = nowMs;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.6 + Math.random() * 1.2;
      bot.botVx = Math.cos(angle) * speed;
      bot.botVy = Math.sin(angle) * speed;
      // Occasionally idle (30% chance)
      if (Math.random() < 0.3) { bot.botVx = 0; bot.botVy = 0; }
    }
    const vx = bot.botVx ?? 0;
    const vy = bot.botVy ?? 0;
    bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + vx));
    bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + vy));
    if (bot.x <= 60 || bot.x >= WORLD_SIZE - 60) bot.botVx = -(bot.botVx ?? 0);
    if (bot.y <= 60 || bot.y >= WORLD_SIZE - 60) bot.botVy = -(bot.botVy ?? 0);
  }

  updateBotHunter(bot: PlayerState, nowMs: number) {
    // Find nearest living human animal
    const targets = this.state.players.filter((p) => !p.isHunter && p.isAlive && !p.isBot);
    if (targets.length === 0) return;

    // Simple targeting: pick nearest human
    let nearest = targets[0];
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - bot.x, t.y - bot.y);
      if (d < nearestDist) { nearestDist = d; nearest = t; }
    }

    const dx = nearest.x - bot.x;
    const dy = nearest.y - bot.y;
    const dist = Math.hypot(dx, dy);

    // Move toward target at 88% of normal hunter speed
    const SPEED = 3.2;
    if (dist > 20) {
      bot.x = Math.max(60, Math.min(WORLD_SIZE - 60, bot.x + (dx / dist) * SPEED));
      bot.y = Math.max(60, Math.min(WORLD_SIZE - 60, bot.y + (dy / dist) * SPEED));
    }

    // Shoot when within range with 1.8s cooldown — aim at actual player position + noise
    const lastShot = bot.botLastShot ?? 0;
    const DETECTION_RANGE = 380;
    if (dist < DETECTION_RANGE && nowMs - lastShot > 1800) {
      bot.botLastShot = nowMs;
      // Positional error: ±40 world units (beatable but threatening)
      const errorX = (Math.random() - 0.5) * 80;
      const errorY = (Math.random() - 0.5) * 80;
      const targetX = nearest.x + errorX;
      const targetY = nearest.y + errorY;
      this.handleBotShoot(targetX, targetY);
    }
  }

  handleBotShoot(targetX: number, targetY: number) {
    // Bot hunter shoots — uses generous collision radius (60) for fair detection
    let hitPlayer: PlayerState | null = null;
    for (const p of this.state.players) {
      if (p.isHunter || !p.isAlive || p.isBot) continue;
      const dist = Math.hypot(targetX - p.x, targetY - p.y);
      if (dist <= PLAYER_COLLISION_RADIUS * 1.8) { hitPlayer = p; break; }
    }

    if (hitPlayer) {
      if (hitPlayer.perk === "extraLife" && !hitPlayer.extraLifeUsed) {
        hitPlayer.animalType = randomAnimalExcept(hitPlayer.animalType);
        hitPlayer.x = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.y = Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50;
        hitPlayer.perk = "none";
        hitPlayer.extraLifeUsed = true;
        this.state.eventLog.unshift(`${hitPlayer.username}'s Extra Life saved them!`);
        this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true, extraLife: true, animalType: hitPlayer.animalType, x: hitPlayer.x, y: hitPlayer.y } });
      } else {
        hitPlayer.isAlive = false;
        this.state.eventLog.unshift(`${hitPlayer.username} was tagged by the AI Hunter!`);
        this.broadcast({ type: "HIT", payload: { targetId: hitPlayer.id, targetX, targetY, hit: true } });
        this.checkWinCondition();
      }
    } else {
      this.state.eventLog.unshift("AI Hunter missed!");
      this.broadcast({ type: "HIT", payload: { targetId: null, targetX, targetY, hit: false } });
    }
    this.state.eventLog = this.state.eventLog.slice(0, 10);
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





