import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoom, joinRoom, listPublicRooms, roomDirectoryErrorMessage, RoomDirectoryError } from "./roomDirectory";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("room directory service", () => {
  it("lists public rooms from the backend directory", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rooms: [{
      roomId: "RIVER-123", name: "River Run", visibility: "public", playerCount: 2,
      maxPlayers: 8, phase: "LOBBY", joinable: true, createdAt: 1, updatedAt: 2,
    }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const rooms = await listPublicRooms();

    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toBe("River Run");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe("/api/rooms");
    expect(requestUrl.searchParams.get("activity")).toBe("hunt");
    expect(init).toEqual(expect.objectContaining({ method: "GET" }));
  });

  it("sends private room credentials only in the HTTPS create body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      room: { roomId: "MOON-123", name: "Moon Camp", visibility: "private", playerCount: 0, maxPlayers: 6, phase: "LOBBY", joinable: true, createdAt: 1, updatedAt: 1 },
      accessToken: "opaque-token",
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRoom({ name: "Moon Camp", visibility: "private", password: "private-pass", maxPlayers: 6 });

    expect(result.accessToken).toBe("opaque-token");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("private-pass");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Moon Camp", visibility: "private", password: "private-pass" });
  });

  it("maps backend join failures to a safe user-facing error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "invalid_credentials",
      detail: "Room name or password is incorrect.",
    }), { status: 401, headers: { "content-type": "application/json" } })));

    await expect(joinRoom({ roomName: "Hidden", password: "wrong" })).rejects.toEqual(
      expect.objectContaining<Partial<RoomDirectoryError>>({ code: "invalid_credentials", status: 401 }),
    );
  });

  it("maps network and malformed JSON failures without leaking response internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("socket details")));
    await expect(listPublicRooms()).rejects.toMatchObject({ code: "network_error", status: 0 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not-json", { status: 502 })));
    await expect(listPublicRooms()).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });

  it("rejects malformed room and token payloads at the client trust boundary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ rooms: [{ name: "Missing fields" }] }), {
      status: 200, headers: { "content-type": "application/json" },
    })));
    await expect(listPublicRooms()).rejects.toMatchObject({ code: "invalid_response" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ room: {
      roomId: "RIVER-123", name: "River", visibility: "public", playerCount: 0, maxPlayers: 8,
      phase: "LOBBY", joinable: true, createdAt: 1, updatedAt: 1,
    }, accessToken: 42 }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(joinRoom({ roomId: "RIVER-123" })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("filters non-public or unavailable entries and formats unknown errors safely", async () => {
    const base = { roomId: "ONE-1234", name: "One", playerCount: 0, maxPlayers: 8, phase: "LOBBY", createdAt: 1, updatedAt: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ rooms: [
      { ...base, visibility: "private", joinable: true },
      { ...base, roomId: "TWO-1234", visibility: "public", joinable: false },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    expect(await listPublicRooms()).toEqual([]);
    expect(roomDirectoryErrorMessage(new Error("internal"))).toBe("Something went wrong. Try again.");
    expect(roomDirectoryErrorMessage(new RoomDirectoryError("safe", 400, "Safe message"))).toBe("Safe message");
  });
});
