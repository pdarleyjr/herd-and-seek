import type { PlayerState, SerializedState } from "../../types";

export class MatchStateAdapter {
  readonly state: SerializedState | null;
  readonly localUserId: string;
  constructor(state: SerializedState | null, localUserId: string) { this.state = state; this.localUserId = localUserId; }

  localPlayer(): PlayerState | undefined { return this.state?.players.find((player) => player.id === this.localUserId); }
  remotePlayers(): PlayerState[] { return this.state?.players.filter((player) => player.id !== this.localUserId) ?? []; }
  livingAnimals(): PlayerState[] { return this.state?.players.filter((player) => !player.isHunter && player.isAlive) ?? []; }
  canSimulateLocal(): boolean { return this.state?.phase === "PLAYING" && Boolean(this.localPlayer()?.isAlive); }
}
