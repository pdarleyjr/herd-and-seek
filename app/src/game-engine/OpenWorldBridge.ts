import type {
  OpenWorldProfile,
  OpenWorldZoneState,
  QuestId,
  QuestProgress,
} from "../open-world/openWorldTypes";
import type { ContextAction } from "../open-world/openWorldControls";

export interface OpenWorldSnapshot {
  zoneState: OpenWorldZoneState | null;
  profile: OpenWorldProfile | null;
  questProgress: Record<string, QuestProgress>;
}

export interface OpenWorldRuntime {
  userId: string;
  username: string;
  animalType: string;
  onSync: (x: number, y: number, animalType?: string) => void;
  onCollectNode: (nodeId: string) => void;
  onAcceptQuest: (questId: QuestId) => void;
  onClaimQuest: (questId: QuestId) => void;
}

type Listener<T> = (payload: T) => void;

export class OpenWorldBridge {
  snapshot: OpenWorldSnapshot = { zoneState: null, profile: null, questProgress: {} };
  runtime: OpenWorldRuntime;
  private readonly snapshotListeners = new Set<Listener<OpenWorldSnapshot>>();
  private readonly actionListeners = new Set<Listener<void>>();
  private readonly joystickListeners = new Set<Listener<{ x: number; y: number }>>();
  private readonly targetListeners = new Set<Listener<{ x: number; y: number }>>();
  private readonly readyListeners = new Set<Listener<string>>();
  private readonly promptListeners = new Set<Listener<ContextAction | null>>();
  private readonly positionListeners = new Set<Listener<{ x: number; y: number }>>();

  constructor(runtime: OpenWorldRuntime) { this.runtime = runtime; }

  updateRuntime(runtime: OpenWorldRuntime): void { this.runtime = runtime; }
  setSnapshot(snapshot: OpenWorldSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.snapshotListeners) listener(snapshot);
  }
  triggerAction(): void { for (const listener of this.actionListeners) listener(); }
  setJoystick(x: number, y: number): void { for (const listener of this.joystickListeners) listener({ x, y }); }
  setTarget(x: number, y: number): void { for (const listener of this.targetListeners) listener({ x, y }); }
  reportReady(key: string): void { for (const listener of this.readyListeners) listener(key); }
  reportPrompt(prompt: ContextAction | null): void { for (const listener of this.promptListeners) listener(prompt); }
  reportPosition(x: number, y: number): void { for (const listener of this.positionListeners) listener({ x, y }); }

  onSnapshot(listener: Listener<OpenWorldSnapshot>): () => void { return subscribe(this.snapshotListeners, listener); }
  onAction(listener: Listener<void>): () => void { return subscribe(this.actionListeners, listener); }
  onJoystick(listener: Listener<{ x: number; y: number }>): () => void { return subscribe(this.joystickListeners, listener); }
  onTarget(listener: Listener<{ x: number; y: number }>): () => void { return subscribe(this.targetListeners, listener); }
  onReady(listener: Listener<string>): () => void { return subscribe(this.readyListeners, listener); }
  onPrompt(listener: Listener<ContextAction | null>): () => void { return subscribe(this.promptListeners, listener); }
  onPosition(listener: Listener<{ x: number; y: number }>): () => void { return subscribe(this.positionListeners, listener); }
}

function subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
