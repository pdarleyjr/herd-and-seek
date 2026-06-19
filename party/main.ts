import type { PartyServer, Connection, PartyKitRoom } from "partykit/server";

export type AnimalType = "elephant" | "penguin" | "monkey" | "giraffe";
export type PerkType = "sprint" | "camouflage" | "none";

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

type GamePhase = "LOBBY" | "PLAYING" | "ENDED";

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

const WORLD_SIZE = 2000;
const NPC_RADIUS = 32;
const PLAYER_RADIUS = 32;
const MATCH_DURATION = 120;

function randomAnimal(): AnimalType {
  const animals: AnimalType[] = ["elephant", "penguin", "monkey", "giraffe"];
  return animals[Math.floor(Math.random() * animals.length)];
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

export default class HerdAndSeekServer implements PartyServer {
  state: RoomState;
  syncInterval: ReturnType<typeof setInterval> | null = null;
  countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(public room: PartyKitRoom) {
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

  onConnect(conn: Connection) {
    const userId = conn.uri.searchParams.get("userId") || conn.id;
    const username = conn.uri.searchParams.get("username") || "Anonymous";

    const existing = this.state.players.find((p) => p.id === userId);
    if (!existing) {
      this.state.players.push({
        id: userId,
        username,
        x: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        y: Math.floor(Math.random() * (WORLD_SIZE - 100)) + 50,
        animalType: randomAnimal(),
        isHunter: false,
        isReady: false,
        isAlive: true,
        perk: "none",
      });
    }

    this.broadcastState();
  }

  onClose(conn: Connection) {
    const userId = conn.uri.searchParams.get("userId") || conn.id;
    this.state.players = this.state.players.filter((p) => p.id !== userId);

    if (this.state.phase === "PLAYING" && this.state.hunterId === userId) {
      this.endGame("animals", "Hunter disconnected!");
    } else if (this.state.phase === "PLAYING") {
      this.checkWinCondition();
    }

    this.broadcastState();
  }

  onMessage(msg: string, conn: Connection) {
    const userId = conn.uri.searchParams.get("userId") || conn.id;
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(msg);
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
    this.state.ammo = animalCount * 2;
    this.state.maxAmmo = animalCount * 2;
    this.state.npcSeeds = generateNpcSeeds(npcCountForPlayers(players.length));
    this.state.phase = "PLAYING";
    this.state.timeRemaining = MATCH_DURATION;
    this.state.matchStartTime = Date.now();
    this.state.winner = null;
    this.state.eventLog = [`Match started! ${animalCount} animal(s) hiding.`];

    this.startSyncLoop();
    this.startCountdown();

    this.room.broadcast(JSON.stringify({ type: "MATCH_START", payload: this.serializeState() }));
  }

  handleShoot(payload: any) {
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
      this.room.broadcast(
        JSON.stringify({
          type: "HIT",
          payload: { targetId: hitPlayer.id, targetX, targetY, hit: true },
        })
      );
      this.checkWinCondition();
    } else {
      this.state.ammo -= 1;
      this.state.eventLog.unshift(`Hunter missed! ${this.state.ammo} ammo left.`);
      this.state.eventLog = this.state.eventLog.slice(0, 8);
      this.room.broadcast(
        JSON.stringify({
          type: "HIT",
          payload: { targetId: null, targetX, targetY, hit: false },
        })
      );
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
    this.state.phase = "ENDED";
    this.state.winner = winner;
    this.state.eventLog.unshift(`Game Over: ${reason}`);
    this.state.eventLog = this.state.eventLog.slice(0, 10);
    this.stopLoops();

    this.room.broadcast(
      JSON.stringify({
        type: "GAME_OVER",
        payload: { winner, reason, state: this.serializeState() },
      })
    );
  }

  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.state.phase === "PLAYING") {
        this.room.broadcast(
          JSON.stringify({ type: "SYNC_STATE", payload: this.serializeState() })
        );
      }
    }, 1000 / 30);
  }

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      if (this.state.phase !== "PLAYING") return;
      const elapsed = (Date.now() - this.state.matchStartTime) / 1000;
      this.state.timeRemaining = Math.max(0, MATCH_DURATION - Math.floor(elapsed));

      if (this.state.timeRemaining <= 0) {
        this.endGame("animals", "Time expired! Animals survived!");
      }
    }, 1000);
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

  broadcastState() {
    this.room.broadcast(
      JSON.stringify({ type: "SYNC_STATE", payload: this.serializeState() })
    );
  }
}

HerdAndSeekServer satisfies PartyServer;
