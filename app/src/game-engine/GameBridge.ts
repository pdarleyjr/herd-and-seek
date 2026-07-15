import type { ClientMessage, SerializedState } from "../types";
import { createGameEventBus, type GameEventBus } from "./EventBus";
import type { GameRuntimeContext, QualityTier } from "./types";

export class GameBridge {
  readonly events: GameEventBus = createGameEventBus();
  state: SerializedState | null = null;
  quality: QualityTier = "balanced";

  runtime: GameRuntimeContext;

  constructor(runtime: GameRuntimeContext, quality: QualityTier = "balanced") {
    this.runtime = runtime;
    this.quality = quality;
    this.bindOutboundEvents();
  }

  updateRuntime(runtime: GameRuntimeContext): void {
    this.runtime = runtime;
    this.events.emit("LOCAL_PROFILE", { userId: runtime.userId, username: runtime.username });
  }

  setState(state: SerializedState | null): void {
    const previousPhase = this.state?.phase;
    this.state = state;
    this.events.emit("MATCH_STATE", { state });
    if (state?.phase === "PLAYING" && previousPhase !== "PLAYING") this.events.emit("MATCH_START", { state });
    if (state?.phase === "ENDED" && previousPhase !== "ENDED") this.events.emit("MATCH_END", { state });
  }

  setQuality(tier: QualityTier): void {
    this.quality = tier;
    this.events.emit("QUALITY_CHANGED", { tier });
  }

  send(message: ClientMessage): void {
    this.runtime.send(message);
  }

  destroy(): void {
    this.events.clear();
  }

  private bindOutboundEvents(): void {
    this.events.on("LOCAL_MOVE", ({ x, y, sequence, timestamp }) => {
      this.runtime.localPosition.current = { x, y };
      this.send({ type: "SYNC", payload: { x, y, sequence, timestamp } });
    });
    this.events.on("SHOOT", (payload) => this.send({ type: "SHOOT", payload }));
    this.events.on("PERK_ACTIVATE", ({ perk }) => this.send({ type: "ACTIVATE_PERK", payload: { perk } }));
  }
}
