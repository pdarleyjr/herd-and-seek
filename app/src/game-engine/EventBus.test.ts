import { describe, expect, it, vi } from "vitest";
import { createGameEventBus } from "./EventBus";

describe("game event bridge", () => {
  it("delivers typed events and unsubscribes cleanly", () => {
    const bus = createGameEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.on("QUALITY_CHANGED", listener);

    bus.emit("QUALITY_CHANGED", { tier: "balanced" });
    unsubscribe();
    bus.emit("QUALITY_CHANGED", { tier: "high" });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ tier: "balanced" });
  });

  it("clears scene listeners without affecting later subscriptions", () => {
    const bus = createGameEventBus();
    const stale = vi.fn();
    bus.on("MATCH_STATE", stale);
    bus.clear();

    const current = vi.fn();
    bus.on("MATCH_STATE", current);
    bus.emit("MATCH_STATE", { state: null });

    expect(stale).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();
  });
});
