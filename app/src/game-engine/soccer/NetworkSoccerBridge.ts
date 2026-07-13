import { BACKEND_WS_ORIGIN } from "../../backend";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./rules";
import type {
  SoccerBridge,
  SoccerCommand,
  SoccerMatchSnapshot,
  SoccerPlayerSnapshot,
  SoccerSnapshotListener,
  SoccerTeamId,
} from "./types";

const SOCKET_OPEN = 1;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 6_400;
const DEFAULT_MAX_ATTEMPTS = 8;

export type NetworkSoccerConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed"
  | "destroyed";

export type SoccerSocketFactory = (url: string) => WebSocket;
export type NetworkSoccerStatusListener = (status: NetworkSoccerConnectionStatus) => void;

export interface SoccerReconnectOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export interface NetworkSoccerBridgeOptions {
  roomId: string;
  userId: string;
  username: string;
  team: SoccerTeamId;
  teamSize?: 3 | 5;
  /** Opaque private-room capability; never a room password. */
  accessToken?: string;
  /** Defaults to the configured Herd & Seek Worker websocket origin. */
  endpointOrigin?: string;
  /** Optional server-provided state to render while the socket connects. */
  initialSnapshot?: SoccerMatchSnapshot;
  /** Dependency-injection seam for tests and alternate runtimes. */
  socketFactory?: SoccerSocketFactory;
  reconnect?: Partial<SoccerReconnectOptions>;
}

export interface SoccerSocketUrlOptions {
  endpointOrigin?: string;
  roomId: string;
  userId: string;
  username: string;
  team: SoccerTeamId;
  teamSize?: 3 | 5;
  accessToken?: string;
}

/**
 * Build the authoritative soccer socket URL. Identity fields are deliberately
 * query parameters while the room id is an encoded path segment, matching the
 * Worker route `/api/soccer/:roomId/websocket`.
 */
export function buildSoccerSocketUrl(options: SoccerSocketUrlOptions): string {
  const origin = new URL(options.endpointOrigin ?? BACKEND_WS_ORIGIN);
  if (origin.protocol === "http:") origin.protocol = "ws:";
  if (origin.protocol === "https:") origin.protocol = "wss:";
  if (origin.protocol !== "ws:" && origin.protocol !== "wss:") {
    throw new TypeError("Soccer endpoint origin must use http(s) or ws(s)");
  }
  origin.pathname = `/api/soccer/${encodeURIComponent(required(options.roomId, "roomId"))}/websocket`;
  const search = new URLSearchParams({
    userId: required(options.userId, "userId"),
    username: required(options.username, "username"),
    team: options.team,
  });
  if (options.teamSize) search.set("teamSize", String(options.teamSize));
  if (options.accessToken) search.set("roomAccess", options.accessToken);
  origin.search = search.toString();
  origin.hash = "";
  return origin.toString();
}

/**
 * Network implementation of SoccerBridge. It transports intent and renders
 * only server snapshots: there is intentionally no `advance` method and no
 * client-side prediction of authoritative state.
 */
export class NetworkSoccerBridge implements SoccerBridge {
  readonly localPlayerId: string;

  private readonly roomId: string;
  private readonly username: string;
  private readonly endpointOrigin: string;
  private readonly teamSize?: 3 | 5;
  private readonly accessToken?: string;
  private readonly socketFactory: SoccerSocketFactory;
  private readonly reconnect: SoccerReconnectOptions;
  private selectedTeam: SoccerTeamId;
  private snapshot: SoccerMatchSnapshot;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private status: NetworkSoccerConnectionStatus = "connecting";
  private readonly snapshotListeners = new Set<SoccerSnapshotListener>();
  private readonly statusListeners = new Set<NetworkSoccerStatusListener>();

  constructor(options: NetworkSoccerBridgeOptions) {
    this.roomId = required(options.roomId, "roomId");
    this.localPlayerId = required(options.userId, "userId");
    this.username = required(options.username, "username");
    this.selectedTeam = options.team;
    this.endpointOrigin = options.endpointOrigin ?? BACKEND_WS_ORIGIN;
    this.teamSize = options.teamSize;
    this.accessToken = options.accessToken;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
    this.reconnect = normalizeReconnect(options.reconnect);
    if (options.initialSnapshot && !isSoccerMatchSnapshot(options.initialSnapshot)) {
      throw new TypeError("initialSnapshot is not a valid SoccerMatchSnapshot");
    }
    this.snapshot = options.initialSnapshot ?? createPendingSnapshot(this.roomId, this.selectedTeam);
    this.connect();
  }

  getSnapshot(): SoccerMatchSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SoccerSnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    listener(this.snapshot);
    return () => this.snapshotListeners.delete(listener);
  }

  getConnectionStatus(): NetworkSoccerConnectionStatus {
    return this.status;
  }

  subscribeConnectionStatus(listener: NetworkSoccerStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  send(command: SoccerCommand): void {
    if (this.destroyed) return;
    if (command.type === "SELECT_TEAM") this.selectedTeam = command.payload.team;
    const active = this.socket;
    // Commands are intentionally not queued. Replaying old movement or kicks
    // after a reconnect would violate the user's current intent.
    if (!active || active.readyState !== SOCKET_OPEN) return;
    active.send(JSON.stringify(command));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearReconnectTimer();
    const active = this.socket;
    this.socket = null;
    this.setStatus("destroyed");
    this.snapshotListeners.clear();
    this.statusListeners.clear();
    if (!active) return;
    try {
      active.close(1000, "client_destroy");
    } catch {
      // The bridge is already inert even if the browser rejects close().
    }
  }

  private connect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = null;
    this.setStatus("connecting");
    let socket: WebSocket;
    try {
      socket = this.socketFactory(buildSoccerSocketUrl({
        endpointOrigin: this.endpointOrigin,
        roomId: this.roomId,
        userId: this.localPlayerId,
        username: this.username,
        team: this.selectedTeam,
        teamSize: this.teamSize,
        accessToken: this.accessToken,
      }));
    } catch {
      this.socket = null;
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (!this.isCurrent(socket)) return;
      this.reconnectAttempt = 0;
      this.setStatus("connected");
    };

    socket.onmessage = (event) => {
      if (!this.isCurrent(socket)) return;
      const incoming = parseSnapshotEnvelope(event.data);
      if (!incoming || incoming.revision <= this.snapshot.revision) return;
      this.snapshot = incoming;
      for (const listener of this.snapshotListeners) listener(incoming);
    };

    socket.onerror = () => {
      if (!this.isCurrent(socket)) return;
      this.setStatus("disconnected");
    };

    socket.onclose = () => {
      if (!this.isCurrent(socket)) return;
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private isCurrent(socket: WebSocket): boolean {
    return !this.destroyed && this.socket === socket;
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer !== null) return;
    if (this.reconnectAttempt >= this.reconnect.maxAttempts) {
      this.setStatus("failed");
      return;
    }
    const delay = Math.min(
      this.reconnect.maxDelayMs,
      this.reconnect.baseDelayMs * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(next: NetworkSoccerConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}

export function createNetworkSoccerBridge(options: NetworkSoccerBridgeOptions): SoccerBridge {
  return new NetworkSoccerBridge(options);
}

function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError(`${label} is required`);
  return trimmed;
}

function normalizeReconnect(options: Partial<SoccerReconnectOptions> | undefined): SoccerReconnectOptions {
  const baseDelayMs = positiveInteger(options?.baseDelayMs, DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, positiveInteger(options?.maxDelayMs, DEFAULT_MAX_DELAY_MS));
  const maxAttempts = nonNegativeInteger(options?.maxAttempts, DEFAULT_MAX_ATTEMPTS);
  return { baseDelayMs, maxDelayMs, maxAttempts };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function createPendingSnapshot(roomId: string, team: SoccerTeamId): SoccerMatchSnapshot {
  return {
    matchId: roomId,
    revision: -1,
    phase: "kickoff",
    coralScore: 0,
    tealScore: 0,
    remainingMs: 0,
    phaseRemainingMs: 0,
    kickoffTeam: team,
    ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, spin: 0 },
    players: [],
  };
}

function parseSnapshotEnvelope(raw: unknown): SoccerMatchSnapshot | null {
  if (typeof raw !== "string") return null;
  try {
    const frame: unknown = JSON.parse(raw);
    if (!isRecord(frame) || frame.type !== "SOCCER_SNAPSHOT") return null;
    return isSoccerMatchSnapshot(frame.payload) ? frame.payload : null;
  } catch {
    return null;
  }
}

function isSoccerMatchSnapshot(value: unknown): value is SoccerMatchSnapshot {
  if (!isRecord(value)) return false;
  if (!nonEmptyString(value.matchId) || !integerAtLeast(value.revision, 0)) return false;
  if (!isOneOf(value.phase, ["kickoff", "playing", "goal", "ended"] as const)) return false;
  if (!nonNegativeNumber(value.coralScore) || !nonNegativeNumber(value.tealScore)) return false;
  if (!nonNegativeNumber(value.remainingMs) || !nonNegativeNumber(value.phaseRemainingMs)) return false;
  if (!isOneOf(value.kickoffTeam, ["coral", "teal"] as const)) return false;
  if (value.lastScorerId !== undefined && typeof value.lastScorerId !== "string") return false;
  if (value.lastTouchPlayerId !== undefined && typeof value.lastTouchPlayerId !== "string") return false;
  if (!isBall(value.ball) || !Array.isArray(value.players)) return false;
  return value.players.every(isPlayer);
}

function isBall(value: unknown): boolean {
  return isRecord(value)
    && finiteNumber(value.x)
    && finiteNumber(value.y)
    && finiteNumber(value.vx)
    && finiteNumber(value.vy)
    && finiteNumber(value.spin);
}

function isPlayer(value: unknown): value is SoccerPlayerSnapshot {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.id)
    && typeof value.username === "string"
    && isOneOf(value.team, ["coral", "teal"] as const)
    && isOneOf(value.role, ["keeper", "midfielder", "striker"] as const)
    && finiteNumber(value.x)
    && finiteNumber(value.y)
    && finiteNumber(value.vx)
    && finiteNumber(value.vy)
    && finiteNumber(value.facingX)
    && finiteNumber(value.facingY)
    && typeof value.isAi === "boolean"
    && finiteNumber(value.energy)
    && nonNegativeNumber(value.kickCooldownMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegativeNumber(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function integerAtLeast(value: unknown, minimum: number): value is number {
  return finiteNumber(value) && Number.isInteger(value) && value >= minimum;
}

function isOneOf<const T extends readonly unknown[]>(value: unknown, allowed: T): value is T[number] {
  return allowed.includes(value);
}
