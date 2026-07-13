export type RoomVisibility = "public" | "private";
export type RoomActivity = "hunt" | "soccer";
export type DirectoryRoomPhase = "LOBBY" | "COUNTDOWN" | "PLAYING" | "ENDED";

export interface RoomDirectoryRecord {
  roomId: string;
  name: string;
  nameKey: string;
  visibility: RoomVisibility;
  activity?: RoomActivity;
  passwordSalt?: string;
  passwordVerifier?: string;
  accessTokenDigests: Record<string, number>;
  playerCount: number;
  maxPlayers: number;
  phase: DirectoryRoomPhase;
  createdAt: number;
  updatedAt: number;
}

export interface PublicRoomSummary {
  roomId: string;
  name: string;
  visibility: RoomVisibility;
  activity: RoomActivity;
  playerCount: number;
  maxPlayers: number;
  phase: DirectoryRoomPhase;
  joinable: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "room-directory:v1";
const ROOM_TTL_MS = 6 * 60 * 60 * 1_000;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1_000;
// Cloudflare Workers' Web Crypto runtime rejects PBKDF2 iteration counts above
// 100,000. Keep this exported so the platform ceiling stays regression-tested.
export const PASSWORD_ITERATIONS = 100_000;
const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(first: string, second: string): boolean {
  const maxLength = Math.max(first.length, second.length);
  let difference = first.length ^ second.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function deriveRoomPasswordVerifier(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: PASSWORD_ITERATIONS,
  }, material, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

function normalizedName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function nameKey(name: string): string {
  return name.toLocaleLowerCase("en-US");
}

function isVisibility(value: unknown): value is RoomVisibility {
  return value === "public" || value === "private";
}

function isActivity(value: unknown): value is RoomActivity {
  return value === "hunt" || value === "soccer";
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

function validMaxPlayers(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 2 && Number(value) <= 12;
}

function isDirectoryPhase(value: unknown): value is DirectoryRoomPhase {
  return value === "LOBBY" || value === "COUNTDOWN" || value === "PLAYING" || value === "ENDED";
}

function summary(record: RoomDirectoryRecord): PublicRoomSummary {
  return {
    roomId: record.roomId,
    name: record.name,
    visibility: record.visibility,
    activity: record.activity ?? "hunt",
    playerCount: record.playerCount,
    maxPlayers: record.maxPlayers,
    phase: record.phase,
    joinable: record.phase === "LOBBY" && record.playerCount < record.maxPlayers,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function randomRoomId(records: Record<string, RoomDirectoryRecord>): string {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const bytes = randomBytes(8);
    let code = "";
    for (const byte of bytes) code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
    // HSR marks directory-managed IDs. If a record later expires, the
    // authorization path can still fail it closed without breaking legacy
    // explicit codes that pre-date room discovery.
    const roomId = `HSR-${code.slice(0, 4)}-${code.slice(4)}`;
    if (!records[roomId]) return roomId;
  }
  return `HSR-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
}

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export class RoomDirectoryDurableObject implements DurableObject {
  private records: Record<string, RoomDirectoryRecord> = {};
  private readonly ready: Promise<void>;

  constructor(private readonly ctx: DurableObjectState) {
    const load = async () => {
      this.records = (await this.ctx.storage.get<Record<string, RoomDirectoryRecord>>(STORAGE_KEY)) ?? {};
    };
    this.ready = this.ctx.blockConcurrencyWhile ? this.ctx.blockConcurrencyWhile(load) : load();
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");

    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    if (path === "/rooms" && request.method === "GET") return this.list(request);
    if (path === "/rooms" && request.method === "POST") return this.create(request);
    if (path === "/rooms/join" && request.method === "POST") return this.join(request);
    if (path === "/authorize" && request.method === "POST") return this.authorize(request);
    if (path === "/internal/status" && request.method === "POST") return this.updateStatus(request);
    return json({ error: "not_found" }, 404);
  }

  private async list(request: Request): Promise<Response> {
    await this.prune();
    const requestedActivity = new URL(request.url).searchParams.get("activity");
    const rooms = Object.values(this.records)
      .filter((record) => record.visibility === "public")
      .filter((record) => !isActivity(requestedActivity) || (record.activity ?? "hunt") === requestedActivity)
      .map(summary)
      .filter((room) => room.joinable)
      .sort((first, second) => second.playerCount - first.playerCount || second.updatedAt - first.updatedAt)
      .slice(0, 60);
    return json({ rooms, refreshedAt: Date.now() });
  }

  private async create(request: Request): Promise<Response> {
    await this.prune();
    const body = await requestBody(request);
    if (!body) return json({ error: "invalid_request", detail: "Send a JSON room request." }, 400);
    const name = normalizedName(body.name);
    if (!name) return json({ error: "invalid_name", detail: "Room names must be 3 to 32 characters." }, 400);
    if (!isVisibility(body.visibility)) return json({ error: "invalid_visibility", detail: "Choose public or private." }, 400);
    if (body.activity !== undefined && !isActivity(body.activity)) return json({ error: "invalid_activity", detail: "Choose hunt or soccer." }, 400);
    const activity: RoomActivity = body.activity === undefined ? "hunt" : body.activity as RoomActivity;
    const maxPlayers = body.maxPlayers === undefined ? 8 : body.maxPlayers;
    if (!validMaxPlayers(maxPlayers)) return json({ error: "invalid_max_players", detail: "Rooms support 2 to 12 players." }, 400);
    if (activity === "soccer" && maxPlayers !== 6 && maxPlayers !== 10) return json({ error: "invalid_max_players", detail: "Soccer rooms support 3v3 or 5v5." }, 400);
    if (body.visibility === "private" && !validPassword(body.password)) {
      return json({ error: "invalid_password", detail: "Private room passwords must be 8 to 72 characters." }, 400);
    }
    const key = nameKey(name);
    if (Object.values(this.records).some((record) => record.nameKey === key)) {
      return json({ error: "name_unavailable", detail: "That room name is already active." }, 409);
    }

    const now = Date.now();
    const roomId = randomRoomId(this.records);
    const record: RoomDirectoryRecord = {
      roomId,
      name,
      nameKey: key,
      visibility: body.visibility,
      activity,
      accessTokenDigests: {},
      playerCount: 0,
      maxPlayers,
      phase: "LOBBY",
      createdAt: now,
      updatedAt: now,
    };

    let accessToken: string | undefined;
    if (body.visibility === "private") {
      const salt = randomBytes(16);
      record.passwordSalt = bytesToBase64Url(salt);
      record.passwordVerifier = await deriveRoomPasswordVerifier(body.password as string, salt);
      accessToken = await this.issueAccessToken(record, now);
    }
    this.records[roomId] = record;
    await this.persist();
    return json({ room: summary(record), ...(accessToken ? { accessToken } : {}) }, 201);
  }

  private async join(request: Request): Promise<Response> {
    await this.prune();
    const body = await requestBody(request);
    if (!body) return json({ error: "invalid_request", detail: "Send a JSON join request." }, 400);
    const requestedName = normalizedName(body.roomName);
    const requestedId = typeof body.roomId === "string" ? body.roomId.trim().toUpperCase() : "";
    const record = Object.values(this.records).find((candidate) =>
      requestedName ? candidate.nameKey === nameKey(requestedName) : candidate.roomId === requestedId,
    );
    if (!record) return json({ error: "room_not_found", detail: "No active room has that name." }, 404);
    if (isActivity(body.activity) && (record.activity ?? "hunt") !== body.activity) {
      return json({ error: "room_not_found", detail: "No active room has that name for this game mode." }, 404);
    }
    if (record.phase !== "LOBBY" || record.playerCount >= record.maxPlayers) {
      return json({ error: "room_unavailable", detail: "That room is no longer accepting players." }, 409);
    }
    if (record.visibility === "public") return json({ room: summary(record) });
    if (typeof body.password !== "string" || body.password.length === 0) {
      return json({ error: "password_required", detail: "Enter the private room password." }, 400);
    }
    const candidate = await deriveRoomPasswordVerifier(body.password, base64UrlToBytes(record.passwordSalt ?? ""));
    if (!record.passwordVerifier || !constantTimeEqual(candidate, record.passwordVerifier)) {
      return json({ error: "invalid_credentials", detail: "Room name or password is incorrect." }, 401);
    }
    const accessToken = await this.issueAccessToken(record, Date.now());
    record.updatedAt = Date.now();
    await this.persist();
    return json({ room: summary(record), accessToken });
  }

  private async authorize(request: Request): Promise<Response> {
    await this.prune();
    const body = await requestBody(request);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim().toUpperCase() : "";
    const record = this.records[roomId];
    // Explicit room IDs created before the directory existed remain compatible.
    // Directory-managed IDs stay closed after expiration instead of silently
    // downgrading a formerly private room into an unprotected legacy room.
    if (!record) return json({ authorized: !roomId.startsWith("HSR-"), registered: false, visibility: null, activity: null });
    const requestedActivity = isActivity(body?.activity) ? body.activity : null;
    if (requestedActivity && (record.activity ?? "hunt") !== requestedActivity) return json({ authorized: false, registered: true, visibility: record.visibility, activity: record.activity ?? "hunt", maxPlayers: record.maxPlayers });
    if (record.visibility === "public") return json({ authorized: true, registered: true, visibility: "public", activity: record.activity ?? "hunt", maxPlayers: record.maxPlayers });
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    if (!accessToken) return json({ authorized: false, registered: true, visibility: "private", activity: record.activity ?? "hunt", maxPlayers: record.maxPlayers });
    const digest = await sha256(accessToken);
    const expiresAt = record.accessTokenDigests[digest] ?? 0;
    return json({ authorized: expiresAt > Date.now(), registered: true, visibility: "private", activity: record.activity ?? "hunt", maxPlayers: record.maxPlayers });
  }

  private async updateStatus(request: Request): Promise<Response> {
    const body = await requestBody(request);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim().toUpperCase() : "";
    const record = this.records[roomId];
    if (!record) return json({ updated: false });
    if (body?.closed === true) {
      delete this.records[roomId];
      await this.persist();
      return json({ updated: true, removed: true });
    }
    if (typeof body?.playerCount === "number" && Number.isFinite(body.playerCount)) {
      record.playerCount = Math.max(0, Math.min(record.maxPlayers, Math.floor(body.playerCount)));
    }
    if (isDirectoryPhase(body?.phase)) record.phase = body.phase;
    record.updatedAt = Date.now();
    await this.persist();
    return json({ updated: true });
  }

  private async issueAccessToken(record: RoomDirectoryRecord, now: number): Promise<string> {
    const accessToken = bytesToBase64Url(randomBytes(32));
    record.accessTokenDigests[await sha256(accessToken)] = now + TOKEN_TTL_MS;
    return accessToken;
  }

  private async prune(): Promise<void> {
    const now = Date.now();
    let changed = false;
    for (const [roomId, record] of Object.entries(this.records)) {
      if (record.updatedAt < now - ROOM_TTL_MS) {
        delete this.records[roomId];
        changed = true;
        continue;
      }
      for (const [digest, expiresAt] of Object.entries(record.accessTokenDigests)) {
        if (expiresAt <= now) {
          delete record.accessTokenDigests[digest];
          changed = true;
        }
      }
    }
    if (changed) await this.persist();
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, this.records);
  }
}
