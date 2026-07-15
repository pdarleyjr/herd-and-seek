import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOpenWorldSocket } from "./useOpenWorldSocket";

const ORIGINAL_WEB_SOCKET = globalThis.WebSocket;

class MockWebSocket {
  static instances = 0;
  static last: MockWebSocket | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e?: unknown) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances++;
    MockWebSocket.last = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  emit(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

beforeEach(() => {
  MockWebSocket.instances = 0;
  MockWebSocket.last = null;
  // @ts-expect-error assigning mock constructor
  globalThis.WebSocket = MockWebSocket;
});

afterEach(() => {
  globalThis.WebSocket = ORIGINAL_WEB_SOCKET;
  vi.restoreAllMocks();
});

const PROFILE = {
  userId: "u1",
  username: "Tester",
  xp: 10,
  level: 1,
  coins: 50,
  badges: 0,
  ownedCosmetics: [],
  selectedCosmetic: null,
  questProgress: {},
  openWorld: {
    lastZoneId: "savannahReserve",
    lastX: 1,
    lastY: 1,
    discoveredZones: ["savannahReserve"],
    discoveredDistricts: ["lodge"],
    collectedNodeIds: [],
  },
  stats: {},
  isAdmin: false,
};

describe("useOpenWorldSocket", () => {
  it("connects to the correct open-world route", () => {
    const { unmount } = renderHook(() =>
      useOpenWorldSocket({ zoneId: "savannahReserve", userId: "test-user", username: "Test User", animalType: "zebra" }),
    );
    const ws = MockWebSocket.last!;
    expect(ws.url).toContain("/open-world");
    expect(ws.url).toContain("zoneId=savannahReserve");
    expect(ws.url).toContain("userId=test-user");
    unmount();
  });

  it("auto-joins the zone only after the socket opens", () => {
    const { result, unmount } = renderHook(() =>
      useOpenWorldSocket({ zoneId: "savannahReserve", userId: "test-user", username: "Test User", animalType: "zebra" }),
    );
    const ws = MockWebSocket.last!;
    expect(ws.sent).toHaveLength(0);
    expect(result.current.connected).toBe(false);

    act(() => {
      ws.open();
    });

    expect(result.current.connected).toBe(true);
    expect(ws.sent).toHaveLength(1);
    const first = JSON.parse(ws.sent[0]);
    expect(first.type).toBe("OPEN_WORLD_JOIN");
    expect(first.payload.zoneId).toBe("savannahReserve");
    expect(first.payload.userId).toBe("test-user");
    expect(first.payload.animalType).toBe("zebra");
    unmount();
  });

  it("handles zone state, profile, quest progress, rewards, and errors", () => {
    const { result, unmount } = renderHook(() =>
      useOpenWorldSocket({ zoneId: "savannahReserve", userId: "u1", username: "Tester", animalType: "zebra" }),
    );
    const ws = MockWebSocket.last!;
    act(() => {
      ws.open();
    });

    act(() => {
      ws.emit({
        type: "OPEN_WORLD_STATE",
        payload: {
          zoneId: "savannahReserve",
          players: [],
          collectibles: [{ id: "n1", x: 1, y: 1, kind: "coin", value: 5 }],
          quests: [],
          activeWorldEvent: null,
          serverTime: 123,
        },
      });
    });
    expect(result.current.zoneState?.collectibles[0].id).toBe("n1");

    act(() => {
      ws.emit({ type: "PROFILE_SYNC", payload: PROFILE });
    });
    expect(result.current.profile?.coins).toBe(50);

    act(() => {
      ws.emit({
        type: "QUEST_UPDATED",
        payload: { questId: "repeat_gather_food", status: "active", progress: 2, targetCount: 5 },
      });
    });
    expect(result.current.questProgress.repeat_gather_food.progress).toBe(2);

    act(() => {
      ws.emit({ type: "REWARD_GRANTED", payload: { coins: 25, xp: 20, badges: 0, reason: "quest_repeat_gather_food" } });
    });
    expect(result.current.rewards[0].coins).toBe(25);

    act(() => {
      ws.emit({ type: "OPEN_WORLD_ERROR", payload: { code: "no_node", message: "Node not found" } });
    });
    expect(result.current.error?.code).toBe("no_node");
    unmount();
  });

  it("does not throw on malformed JSON frames", () => {
    const { result, unmount } = renderHook(() =>
      useOpenWorldSocket({ zoneId: "savannahReserve", userId: "u1", username: "Tester", animalType: "zebra" }),
    );
    const ws = MockWebSocket.last!;
    act(() => {
      ws.open();
    });
    expect(() => {
      act(() => {
        ws.emit("this is not json");
      });
    }).not.toThrow();
    expect(result.current.connected).toBe(true);
    unmount();
  });

  it("sends movement only when connected, and leaves cleanly", () => {
    const { result, unmount } = renderHook(() =>
      useOpenWorldSocket({ zoneId: "savannahReserve", userId: "u1", username: "Tester", animalType: "zebra" }),
    );
    const ws = MockWebSocket.last!;

    act(() => {
      result.current.sync(10, 20, "zebra");
    });
    // Not open yet — nothing should be sent.
    expect(ws.sent).toHaveLength(0);

    act(() => {
      ws.open();
    });
    expect(ws.sent).toHaveLength(1); // join only

    act(() => {
      result.current.sync(10, 20, "zebra");
    });
    const syncMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(syncMsg.type).toBe("OPEN_WORLD_SYNC");
    expect(syncMsg.payload).toMatchObject({ x: 10, y: 20 });

    act(() => {
      result.current.leave();
    });
    const leaveMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(leaveMsg.type).toBe("OPEN_WORLD_LEAVE");
    unmount();
  });

  it("does not create duplicate sockets on rerender", () => {
    const { rerender, unmount } = renderHook(
      ({ userId }) => useOpenWorldSocket({ zoneId: "savannahReserve", userId, username: "Tester", animalType: "zebra" }),
      { initialProps: { userId: "u1" } },
    );
    expect(MockWebSocket.instances).toBe(1);
    rerender({ userId: "u1" });
    rerender({ userId: "u1" });
    expect(MockWebSocket.instances).toBe(1);
    unmount();
  });

  it("reconnects with backoff and rejoins at the latest predicted position", () => {
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderHook(() =>
        useOpenWorldSocket({ zoneId: "savannahReserve", userId: "u1", username: "Tester", animalType: "zebra" }),
      );
      const first = MockWebSocket.last!;
      act(() => first.open());
      act(() => result.current.sync(880, 920, "zebra"));
      act(() => first.close());
      expect(result.current.connected).toBe(false);
      act(() => vi.advanceTimersByTime(600));
      const second = MockWebSocket.last!;
      expect(second).not.toBe(first);
      act(() => second.open());
      const join = JSON.parse(second.sent[0]);
      expect(join.payload).toMatchObject({ x: 880, y: 920, animalType: "zebra" });
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
