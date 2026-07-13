import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RoomDirectoryDurableObject,
  deriveRoomPasswordVerifier,
  type RoomDirectoryRecord,
} from "../src/roomDirectory";
import worker from "../src/index";

function directoryContext() {
  const values = new Map<string, unknown>();
  return {
    values,
    ctx: {
      storage: {
        get: async (key: string) => values.get(key),
        put: async (key: string, value: unknown) => void values.set(key, value),
        delete: async (key: string) => void values.delete(key),
      },
      blockConcurrencyWhile(callback: () => Promise<void>) {
        return callback();
      },
    } as unknown as DurableObjectState,
  };
}

function jsonRequest(path: string, body?: unknown, method = "POST") {
  return new Request(`https://directory${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

describe("room password verifier", () => {
  it("is deterministic for one salt without retaining the password", async () => {
    const salt = new Uint8Array(16).fill(7);
    const first = await deriveRoomPasswordVerifier("correct horse battery", salt);
    const second = await deriveRoomPasswordVerifier("correct horse battery", salt);
    const wrong = await deriveRoomPasswordVerifier("incorrect horse battery", salt);

    expect(first).toBe(second);
    expect(wrong).not.toBe(first);
    expect(first).not.toContain("correct horse battery");
  });
});

describe("RoomDirectoryDurableObject", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates a private room without storing or returning a plaintext password", async () => {
    const { ctx, values } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    const password = "Never Store This 42!";

    const response = await directory.fetch(jsonRequest("/rooms", {
      name: "Moonlit Marsh",
      visibility: "private",
      password,
      maxPlayers: 6,
    }));

    expect(response.status).toBe(201);
    const payload = await responseJson<{ room: Record<string, unknown>; accessToken: string }>(response);
    expect(payload.room).toMatchObject({ name: "Moonlit Marsh", visibility: "private", maxPlayers: 6 });
    expect(payload.room.roomId).toMatch(/^HSR-/);
    expect(payload.accessToken.length).toBeGreaterThan(24);
    expect(JSON.stringify(payload)).not.toContain(password);
    expect(payload.room).not.toHaveProperty("passwordSalt");
    expect(payload.room).not.toHaveProperty("passwordVerifier");

    const persisted = JSON.stringify(values.get("room-directory:v1"));
    expect(persisted).not.toContain(password);
    expect(persisted).toContain("passwordVerifier");
    expect(persisted).toContain("passwordSalt");
  });

  it("lists only public, joinable rooms and never leaks verifier material", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    await directory.fetch(jsonRequest("/rooms", { name: "River Run", visibility: "public", maxPlayers: 8 }));
    await directory.fetch(jsonRequest("/rooms", { name: "Secret Grove", visibility: "private", password: "grove-pass" }));

    const response = await directory.fetch(jsonRequest("/rooms", undefined, "GET"));
    expect(response.status).toBe(200);
    const payload = await responseJson<{ rooms: Array<Record<string, unknown>> }>(response);
    expect(payload.rooms).toHaveLength(1);
    expect(payload.rooms[0]).toMatchObject({ name: "River Run", visibility: "public", playerCount: 0, joinable: true });
    expect(JSON.stringify(payload)).not.toContain("Secret Grove");
    expect(JSON.stringify(payload)).not.toContain("Verifier");
    expect(JSON.stringify(payload)).not.toContain("Salt");
  });

  it("keeps hunt and soccer room joins isolated by activity", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    const created = await responseJson<{ room: { roomId: string; activity: string } }>(await directory.fetch(jsonRequest("/rooms", {
      name: "Field League One",
      visibility: "public",
      maxPlayers: 6,
      activity: "soccer",
    })));
    expect(created.room.activity).toBe("soccer");
    expect((await directory.fetch(jsonRequest("/rooms/join", { roomId: created.room.roomId, activity: "hunt" }))).status).toBe(404);
    expect((await directory.fetch(jsonRequest("/rooms/join", { roomId: created.room.roomId, activity: "soccer" }))).status).toBe(200);
  });

  it("requires the private room name and correct password before issuing an opaque access token", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    const created = await responseJson<{ room: { roomId: string } }>(await directory.fetch(jsonRequest("/rooms", {
      name: "Coral Castle",
      visibility: "private",
      password: "reef-ranger-7",
    })));

    const missing = await directory.fetch(jsonRequest("/rooms/join", { roomName: "Coral Castle" }));
    expect(missing.status).toBe(400);
    const wrong = await directory.fetch(jsonRequest("/rooms/join", { roomName: "Coral Castle", password: "not-it" }));
    expect(wrong.status).toBe(401);

    const response = await directory.fetch(jsonRequest("/rooms/join", {
      roomName: "  coral castle  ",
      password: "reef-ranger-7",
    }));
    expect(response.status).toBe(200);
    const payload = await responseJson<{ room: { roomId: string }; accessToken: string }>(response);
    expect(payload.room.roomId).toBe(created.room.roomId);
    expect(payload.accessToken).not.toContain("reef-ranger-7");

    const authorized = await directory.fetch(jsonRequest("/authorize", {
      roomId: created.room.roomId,
      accessToken: payload.accessToken,
    }));
    expect(await responseJson(authorized)).toEqual({ authorized: true, registered: true, visibility: "private", activity: "hunt", maxPlayers: 8 });
  });

  it("rejects missing or invalid private access tokens but preserves legacy explicit room IDs", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    const created = await responseJson<{ room: { roomId: string } }>(await directory.fetch(jsonRequest("/rooms", {
      name: "Hidden Hollow",
      visibility: "private",
      password: "hidden-987",
    })));

    for (const accessToken of [undefined, "bad-token"] as const) {
      const response = await directory.fetch(jsonRequest("/authorize", { roomId: created.room.roomId, accessToken }));
      expect(await responseJson(response)).toMatchObject({ authorized: false, registered: true, visibility: "private", maxPlayers: 8 });
    }

    const legacy = await directory.fetch(jsonRequest("/authorize", { roomId: "ABCD-EFGH" }));
    expect(await responseJson(legacy)).toEqual({ authorized: true, registered: false, visibility: null, activity: null });
  });

  it("prevents active duplicate names and validates room input boundaries", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    expect((await directory.fetch(jsonRequest("/rooms", { name: "ok", visibility: "public" }))).status).toBe(400);
    expect((await directory.fetch(jsonRequest("/rooms", { name: "Valid Name", visibility: "private", password: "123" }))).status).toBe(400);
    expect((await directory.fetch(jsonRequest("/rooms", { name: "Valid Name", visibility: "public", maxPlayers: 99 }))).status).toBe(400);
    expect((await directory.fetch(jsonRequest("/rooms", { name: "Invalid Activity", visibility: "public", activity: "racing" }))).status).toBe(400);
    expect((await directory.fetch(jsonRequest("/rooms", { name: "Odd Soccer", visibility: "public", activity: "soccer", maxPlayers: 8 }))).status).toBe(400);

    expect((await directory.fetch(jsonRequest("/rooms", { name: "Sunset Squad", visibility: "public" }))).status).toBe(201);
    const duplicate = await directory.fetch(jsonRequest("/rooms", { name: " sunset   squad ", visibility: "private", password: "valid-pass" }));
    expect(duplicate.status).toBe(409);
  });

  it("updates occupancy from authoritative match status and removes a closed room", async () => {
    const { ctx } = directoryContext();
    const directory = new RoomDirectoryDurableObject(ctx);
    const created = await responseJson<{ room: { roomId: string } }>(await directory.fetch(jsonRequest("/rooms", {
      name: "Busy Burrow",
      visibility: "public",
      maxPlayers: 4,
    })));

    await directory.fetch(jsonRequest("/internal/status", {
      roomId: created.room.roomId,
      playerCount: 4,
      phase: "PLAYING",
      closed: false,
    }));
    const fullList = await responseJson<{ rooms: Array<Record<string, unknown>> }>(await directory.fetch(jsonRequest("/rooms", undefined, "GET")));
    expect(fullList.rooms).toHaveLength(0);

    await directory.fetch(jsonRequest("/internal/status", {
      roomId: created.room.roomId,
      playerCount: 0,
      phase: "LOBBY",
      closed: true,
    }));
    const record = (await ctx.storage.get<Record<string, RoomDirectoryRecord>>("room-directory:v1")) ?? {};
    expect(record[created.room.roomId]).toBeUndefined();
  });

  it("expires stale directory records without downgrading their managed room IDs to legacy access", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    try {
      const { ctx } = directoryContext();
      const directory = new RoomDirectoryDurableObject(ctx);
      const created = await responseJson<{ room: { roomId: string }; accessToken: string }>(await directory.fetch(jsonRequest("/rooms", {
        name: "Long Camp",
        visibility: "private",
        password: "long-camp-pass",
      })));

      vi.advanceTimersByTime(7 * 60 * 60 * 1_000);
      await directory.fetch(jsonRequest("/internal/status", {
        roomId: created.room.roomId,
        playerCount: 1,
        phase: "LOBBY",
        closed: false,
      }));
      vi.advanceTimersByTime(6 * 60 * 60 * 1_000);
      const response = await directory.fetch(jsonRequest("/authorize", {
        roomId: created.room.roomId,
        accessToken: created.accessToken,
      }));
      expect(await responseJson(response)).toEqual({ authorized: false, registered: true, visibility: "private", activity: "hunt", maxPlayers: 8 });

      vi.advanceTimersByTime(1);
      const staleResponse = await directory.fetch(jsonRequest("/authorize", {
        roomId: created.room.roomId,
        accessToken: created.accessToken,
      }));
      expect(await responseJson(staleResponse)).toEqual({ authorized: false, registered: false, visibility: null, activity: null });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Worker room-directory routing", () => {
  function namespace(fetch: (request: Request) => Promise<Response> | Response) {
    return {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ fetch })),
    } as unknown as DurableObjectNamespace;
  }

  it("forwards REST room discovery to the singleton directory", async () => {
    const directoryFetch = vi.fn(async () => jsonResponse({ rooms: [] }));
    const gameFetch = vi.fn(async () => new Response("unexpected"));
    const response = await worker.fetch(new Request("https://worker/api/rooms"), {
      ROOM_DIRECTORY: namespace(directoryFetch),
      GAME_ROOM: namespace(gameFetch),
    } as any);

    expect(response.status).toBe(200);
    expect(directoryFetch).toHaveBeenCalledTimes(1);
    expect(gameFetch).not.toHaveBeenCalled();
  });

  it("fails a private WebSocket handshake closed when the opaque token is absent", async () => {
    const directoryFetch = vi.fn(async () => jsonResponse({ authorized: false, registered: true, visibility: "private", maxPlayers: 6 }));
    const gameFetch = vi.fn(async () => new Response("unexpected"));
    const response = await worker.fetch(new Request("https://worker/?room=HIDE-1234", {
      headers: { Upgrade: "websocket" },
    }), {
      ROOM_DIRECTORY: namespace(directoryFetch),
      GAME_ROOM: namespace(gameFetch),
    } as any);

    expect(response.status).toBe(403);
    expect(gameFetch).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "private_room_access_required" });
  });

  it("forwards an authorized or legacy explicit room to the existing game Durable Object", async () => {
    const directoryFetch = vi.fn(async () => jsonResponse({ authorized: true, registered: true, visibility: "private", maxPlayers: 6 }));
    const gameFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await worker.fetch(new Request("https://worker/?room=HIDE-1234&roomAccess=opaque-token", {
      headers: { Upgrade: "websocket" },
    }), {
      ROOM_DIRECTORY: namespace(directoryFetch),
      GAME_ROOM: namespace(gameFetch),
    } as any);

    expect(response.status).toBe(204);
    expect(gameFetch).toHaveBeenCalledTimes(1);
    const forwardedRequest = gameFetch.mock.calls[0][0] as Request;
    expect(forwardedRequest.headers.get("x-room-max-players")).toBe("6");
    const authorizationInit = directoryFetch.mock.calls[0][1] as RequestInit;
    const authorizationBody = JSON.parse(String(authorizationInit.body)) as Record<string, unknown>;
    expect(authorizationBody).toEqual({ roomId: "HIDE-1234", accessToken: "opaque-token", activity: "hunt" });
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
