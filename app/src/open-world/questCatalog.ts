import type { QuestDefinition, QuestId } from "./openWorldTypes";

// Client-side mirror of the server QUEST_CATALOG (worker/src/index.ts). Used
// only for display and local progress hints. Reward amounts and completion are
// always decided server-side; never trust client progress for payouts.
export const QUEST_CATALOG: QuestDefinition[] = [
  {
    id: "repeat_gather_food",
    title: "Gather Food",
    description: "Collect 5 food/supply nodes around the reserve.",
    objectiveType: "collect",
    targetCount: 5,
    reward: { coins: 25, xp: 20 },
    daily: false,
  },
  {
    id: "repeat_camera_tag",
    title: "Camera Tag",
    description: "Visit 3 wildlife camera points.",
    objectiveType: "camera_tag",
    targetCount: 3,
    reward: { coins: 35, xp: 30 },
    daily: false,
  },
  {
    id: "repeat_water_run",
    title: "Water Run",
    description: "Visit the watering hole and return to the lodge.",
    objectiveType: "visit",
    targetCount: 2,
    reward: { coins: 30, xp: 25 },
    daily: false,
  },
  {
    id: "daily_scout_tracks",
    title: "Scout Tracks",
    description: "Collect 6 track nodes. Resets daily (UTC).",
    objectiveType: "collect",
    targetCount: 6,
    reward: { coins: 75, xp: 60 },
    daily: true,
  },
  {
    id: "daily_collect_tokens",
    title: "Reserve Cleanup",
    description: "Collect 10 scattered supply nodes. Resets daily (UTC).",
    objectiveType: "collect",
    targetCount: 10,
    reward: { coins: 100, xp: 80, badges: 1 },
    daily: true,
  },
  {
    id: "daily_blend_herd",
    title: "Blend With Herd",
    description: "Spend 30s near an ambient herd without sprinting. Resets daily (UTC).",
    objectiveType: "blend_near_herd",
    targetCount: 30,
    reward: { coins: 60, xp: 50 },
    daily: true,
  },
];

export const QUEST_BY_ID: Record<QuestId, QuestDefinition> = QUEST_CATALOG.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<QuestId, QuestDefinition>,
);
