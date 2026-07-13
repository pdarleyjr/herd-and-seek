import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkSoccerBridge, buildSoccerSocketUrl } from "./NetworkSoccerBridge";
import type { SoccerCommand, SoccerMatchSnapshot } from "./types";

class FakeSocket {
  readonly url: string;
  readyState = 0;
  readonly sent: string[] = [];
  closeArgs: [number | undefined, string | undefined] | undefined;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  message(data: string): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  fail(): void {
    this.onerror?.(new Event("error"));
  }

  serverClose(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code, reason: "server_close", wasClean: code === 1000 } as CloseEvent);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeArgs = [code, reason];
    this.readyState = 3;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "", wasClean: true } as CloseEvent);
  }
}

function createSocketHarness(): {
  sockets: FakeSocket[];
  factory: (url: string) => WebSocket;
} {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    factory: (url: string) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  };
}

function snapshot(revision: number, overrides: Partial<SoccerMatchSnapshot> = {}): SoccerMatchSnapshot {
  return {
    matchId: "crew-cup",
    revision,
    phase: "playing",
    coralScore: 1,
    tealScore: 0,
    remainingMs: 125_000,
    phaseRemainingMs: 0,
    kickoffTeam: "coral",
    lastScorerId: "ranger-1",
    lastTouchPlayerId: "ranger-1",
    ball: { x: 1_200, y: 680, vx: 12, vy: -3, spin: 0.2 },
    players: [
      {
        id: "ranger-1",
        username: "Ranger One",
        team: "coral",
        role: "striker",
        x: 900,
        y: 680,
        vx: 80,
        vy: 0,
        facingX: 1,
        facingY: 0,
        isAi: false,
        energy: 0.82,
        kickCooldownMs: 0,
      },
    ],
    ...overrides,
  };
}

function envelope(value: SoccerMatchSnapshot): string {
  return JSON.stringify({ type: "SOCCER_SNAPSHOT", payload: value });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildSoccerSocketUrl", () => {
  it("builds the worker websocket path and safely encodes identity parameters", () => {
    const url = new URL(buildSoccerSocketUrl({
      endpointOrigin: "https://soccer.example.test/",
      roomId: "Sunday Cup/1",
      userId: "user+captain",
      username: "Ranger One",
      team: "teal",
    }));

    expect(url.protocol).toBe("wss:");
    expect(url.host).toBe("soccer.example.test");
    expect(url.pathname).toBe("/api/soccer/Sunday%20Cup%2F1/websocket");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      userId: "user+captain",
      username: "Ranger One",
      team: "teal",
    });
  });
});

describe("NetworkSoccerBridge", () => {
  it("connects immediately, publishes status, and sends typed commands only while open", () => {
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
    });
    const statuses: string[] = [];
    bridge.subscribeConnectionStatus((status) => statuses.push(status));
    const move: SoccerCommand = { type: "MOVE", payload: { x: 1, y: 0, sequence: 1, sprint: true } };

    bridge.send(move);
    expect(sockets[0].sent).toEqual([]);
    sockets[0].open();
    bridge.send(move);

    expect(statuses).toEqual(["connecting", "connected"]);
    expect(sockets[0].sent).toEqual([JSON.stringify(move)]);
    expect(bridge.localPlayerId).toBe("ranger-1");
    expect("advance" in bridge).toBe(false);
  });

  it("accepts only valid newer authoritative snapshots", () => {
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
    });
    const revisions: number[] = [];
    bridge.subscribe((value) => revisions.push(value.revision));
    sockets[0].open();

    sockets[0].message(envelope(snapshot(5)));
    sockets[0].message(envelope(snapshot(4)));
    sockets[0].message(envelope(snapshot(5, { coralScore: 99 })));
    sockets[0].message(JSON.stringify({ type: "CHAT_MESSAGE", payload: snapshot(6) }));
    sockets[0].message(JSON.stringify({ type: "SOCCER_SNAPSHOT", payload: { ...snapshot(7), ball: null } }));
    sockets[0].message("not-json");

    expect(revisions).toEqual([-1, 5]);
    expect(bridge.getSnapshot().coralScore).toBe(1);
    expect(bridge.getSnapshot().revision).toBe(5);
  });

  it("uses a bounded exponential backoff and stops after the configured attempt budget", () => {
    vi.useFakeTimers();
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
      reconnect: { baseDelayMs: 100, maxDelayMs: 250, maxAttempts: 4 },
    });
    const statuses: string[] = [];
    bridge.subscribeConnectionStatus((status) => statuses.push(status));

    sockets[0].serverClose();
    vi.advanceTimersByTime(99);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].serverClose();
    vi.advanceTimersByTime(199);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    sockets[2].serverClose();
    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(4);
    sockets[3].serverClose();
    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(5);

    sockets[4].serverClose();
    vi.runAllTimers();
    expect(sockets).toHaveLength(5);
    expect(statuses.at(-1)).toBe("failed");
    expect(statuses.filter((status) => status === "reconnecting")).toHaveLength(4);
  });

  it("carries a changed team into reconnect identity without replaying stale commands", () => {
    vi.useFakeTimers();
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
      reconnect: { baseDelayMs: 50, maxDelayMs: 50, maxAttempts: 2 },
    });
    const teamChange: SoccerCommand = { type: "SELECT_TEAM", payload: { team: "teal" } };

    bridge.send(teamChange);
    sockets[0].serverClose();
    vi.advanceTimersByTime(50);

    expect(new URL(sockets[1].url).searchParams.get("team")).toBe("teal");
    sockets[1].open();
    expect(sockets[1].sent).toEqual([]);
  });

  it("resets the retry budget after a successful connection", () => {
    vi.useFakeTimers();
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
      reconnect: { baseDelayMs: 25, maxDelayMs: 100, maxAttempts: 1 },
    });

    sockets[0].serverClose();
    vi.advanceTimersByTime(25);
    sockets[1].open();
    sockets[1].serverClose();
    vi.advanceTimersByTime(25);

    expect(sockets).toHaveLength(3);
    expect(bridge.getConnectionStatus()).toBe("connecting");
  });

  it("tears down the socket and prevents reconnects or later snapshot delivery", () => {
    vi.useFakeTimers();
    const { sockets, factory } = createSocketHarness();
    const bridge = new NetworkSoccerBridge({
      endpointOrigin: "wss://soccer.example.test",
      roomId: "crew-cup",
      userId: "ranger-1",
      username: "Ranger One",
      team: "coral",
      socketFactory: factory,
      reconnect: { baseDelayMs: 10, maxDelayMs: 10, maxAttempts: 2 },
    });
    const revisions: number[] = [];
    bridge.subscribe((value) => revisions.push(value.revision));
    sockets[0].open();

    bridge.destroy();
    sockets[0].message(envelope(snapshot(3)));
    vi.runAllTimers();

    expect(sockets[0].closeArgs).toEqual([1000, "client_destroy"]);
    expect(sockets).toHaveLength(1);
    expect(revisions).toEqual([-1]);
    expect(bridge.getConnectionStatus()).toBe("destroyed");
  });
});
