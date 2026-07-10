// Open-world controls helpers: virtual joystick vector math and the single
// context-sensitive action button resolver. There is no hunter shooting in MVP
// open-world mode — the action button adapts to whatever is in range.
import {
  type OpenWorldZoneState,
  type CollectibleNode,
  type QuestProgress,
  type QuestId,
} from "./openWorldTypes";
import { QUEST_BY_ID } from "./questCatalog";

export interface JoystickVector {
  dx: number; // -1..1
  dy: number; // -1..1
  magnitude: number; // 0..1
}

export function joystickVector(
  origin: { x: number; y: number },
  current: { x: number; y: number },
  maxRadius = 60,
): JoystickVector {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, maxRadius);
  const magnitude = maxRadius === 0 ? 0 : clamped / maxRadius;
  if (dist === 0) return { dx: 0, dy: 0, magnitude: 0 };
  return { dx: (dx / dist) * magnitude, dy: (dy / dist) * magnitude, magnitude };
}

export type ContextActionKind =
  | "collect"
  | "accept"
  | "claim"
  | "return"
  | "interact";

export interface ContextAction {
  kind: ContextActionKind;
  label: string;
  questId?: QuestId;
  nodeId?: string;
}

function nearestCollectible(
  zone: OpenWorldZoneState,
  x: number,
  y: number,
  range = 70,
): CollectibleNode | null {
  let best: CollectibleNode | null = null;
  let bestDist = range;
  for (const n of zone.collectibles) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

// Resolve which action the context button should perform for the local player.
export function resolveContextAction(opts: {
  zone: OpenWorldZoneState;
  localX: number;
  localY: number;
  questProgress: Record<string, QuestProgress>;
  lodge: { x: number; y: number };
}): ContextAction | null {
  const { zone, localX, localY, questProgress, lodge } = opts;

  // 1) A collectible in range always takes priority.
  const node = nearestCollectible(zone, localX, localY);
  if (node) {
    return { kind: "collect", label: `Collect ${node.kind}`, nodeId: node.id };
  }

  // 2) A completed-but-unclaimed quest near the lodge becomes "Claim Reward".
  for (const q of zone.quests) {
    const prog = questProgress[q.id];
    if (prog && prog.status === "complete") {
      const dLodge = Math.hypot(localX - lodge.x, localY - lodge.y);
      if (dLodge <= 240) {
        return { kind: "claim", label: "Claim Reward", questId: q.id };
      }
    }
  }

  // 3) An available repeatable quest near the lodge can be accepted.
  for (const q of zone.quests) {
    const prog = questProgress[q.id];
    if (!prog || prog.status === "available") {
      const dLodge = Math.hypot(localX - lodge.x, localY - lodge.y);
      if (dLodge <= 240) {
        return { kind: "accept", label: `Accept ${q.title}`, questId: q.id };
      }
    }
  }

  // 4) Far from lodge: offer a "Return to Lodge" hint button.
  const dLodge = Math.hypot(localX - lodge.x, localY - lodge.y);
  if (dLodge > 320) {
    return { kind: "return", label: "Return to Lodge" };
  }

  return { kind: "interact", label: "Interact" };
}

export function questById(id: QuestId): { rewardLabel: string } {
  const q = QUEST_BY_ID[id];
  const parts = [`${q.reward.coins}c`, `${q.reward.xp}xp`];
  if (q.reward.badges) parts.push(`${q.reward.badges}b`);
  return { rewardLabel: parts.join(" / ") };
}
