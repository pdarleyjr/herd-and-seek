import type { GameEvents } from "./types";

type EventListener<T> = (payload: T) => void;

export interface GameEventBus {
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void;
  on<K extends keyof GameEvents>(event: K, listener: EventListener<GameEvents[K]>): () => void;
  clear(): void;
}

export function createGameEventBus(): GameEventBus {
  const listeners = new Map<keyof GameEvents, Set<EventListener<never>>>();

  return {
    emit(event, payload) {
      for (const listener of listeners.get(event) ?? []) {
        (listener as EventListener<typeof payload>)(payload);
      }
    },
    on(event, listener) {
      let bucket = listeners.get(event);
      if (!bucket) {
        bucket = new Set();
        listeners.set(event, bucket);
      }
      bucket.add(listener as EventListener<never>);
      return () => bucket?.delete(listener as EventListener<never>);
    },
    clear() {
      listeners.clear();
    },
  };
}

export const gameEventBus = createGameEventBus();
