import { useState } from "react";
import OpenWorldCanvas from "./OpenWorldCanvas";
import { useOpenWorldSocket } from "./useOpenWorldSocket";
import { QUEST_CATALOG } from "./questCatalog";

interface OpenWorldScreenProps {
  userId: string;
  username: string;
  animalType: string;
  onExit: () => void;
}

export default function OpenWorldScreen({ userId, username, animalType, onExit }: OpenWorldScreenProps) {
  const ow = useOpenWorldSocket({ userId, username, animalType });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const profile = ow.profile;
  const questProgress = ow.questProgress;

  const activeQuests = QUEST_CATALOG.filter((q) => {
    const p = questProgress[q.id];
    return p && (p.status === "active" || p.status === "complete");
  });

  return (
    <div className="relative w-dvw h-dvh overflow-hidden bg-[#caa869]">
      <OpenWorldCanvas
        userId={userId}
        username={username}
        animalType={animalType}
        zoneState={ow.zoneState}
        profile={profile}
        questProgress={questProgress}
        onSync={ow.sync}
        onCollectNode={ow.collectNode}
        onAcceptQuest={ow.acceptQuest}
        onClaimQuest={ow.claimQuest}
      />

      {/* Exit button */}
      <button
        type="button"
        onClick={() => { ow.leave(); onExit(); }}
        aria-label="Leave the Savannah Reserve"
        className="absolute z-30 top-3 left-3 px-3 py-2 rounded-lg bg-black/60 text-white text-sm font-bold active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ touchAction: "manipulation", top: "max(12px, env(safe-area-inset-top))" }}
      >
        ← Leave
      </button>

      {/* Top-left: quest tracker */}
      <div
        className="absolute z-20 top-3 left-3 max-w-[46vw] bg-black/60 text-white rounded-xl p-3 text-xs sm:text-sm"
        style={{ top: "max(12px, env(safe-area-inset-top))", left: "max(86px, calc(env(safe-area-inset-left) + 72px))" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-[#7fff00]">Savannah Reserve</h3>
          <button
            onPointerDown={(e) => { e.preventDefault(); setDrawerOpen((v) => !v); }}
            className="ml-2 px-2 py-0.5 rounded bg-white/15 text-[10px] active:scale-95 select-none"
          >
            {drawerOpen ? "Hide" : "Quests"}
          </button>
        </div>
        {!ow.connected && <p className="text-[#ffb4b4] text-[10px]">Connecting…</p>}
        {activeQuests.length === 0 && ow.connected && (
          <p className="text-gray-300 text-[10px]">Go to the lodge to accept quests.</p>
        )}
        <div className="space-y-1 mt-1">
          {activeQuests.map((q) => {
            const p = questProgress[q.id];
            const pct = Math.min(100, Math.round((p.progress / p.targetCount) * 100));
            const done = p.status === "complete";
            return (
              <div key={q.id}>
                <div className="flex justify-between">
                  <span className={done ? "text-[#7fff00]" : ""}>{q.title}</span>
                  <span className="text-gray-300">{p.progress}/{p.targetCount}</span>
                </div>
                <div className="h-1 bg-white/15 rounded overflow-hidden">
                  <div className="h-full bg-[#7fff00]" style={{ width: `${pct}%` }} />
                </div>
                {done && (
                  <span className="text-[10px] text-[#7fff00]">Ready to claim at the lodge</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-right: profile summary */}
      <div
        className="absolute z-20 top-3 right-3 bg-black/60 text-white rounded-xl px-3 py-2 text-xs sm:text-sm flex gap-3"
        style={{ top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}
      >
        <span className="font-bold">Lv {profile?.level ?? "?"}</span>
        <span className="text-[#ffcf33]">🪙 {profile?.coins ?? 0}</span>
        <span className="text-[#ffd84d]">🏅 {profile?.badges ?? 0}</span>
      </div>

      {/* Reward toasts */}
      <div className="absolute z-20 top-20 right-3 space-y-1">
        {ow.rewards.slice(0, 3).map((r, i) => (
          <div key={i} className="bg-[#7fff00]/90 text-black rounded-lg px-3 py-1 text-xs font-bold">
            +{r.coins}c +{r.xp}xp{r.badges ? ` +${r.badges}b` : ""}
          </div>
        ))}
      </div>

      {/* Connection / error banner */}
      {ow.error && (
        <div className="absolute z-20 bottom-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-1 rounded-full">
          {ow.error.message}
        </div>
      )}

      {/* Collapsible quest drawer */}
      {drawerOpen && (
        <div
          className="absolute z-30 inset-x-2 bottom-2 bg-black/80 text-white rounded-2xl p-3 max-h-[55vh] overflow-y-auto"
          style={{ bottom: "max(8px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}
        >
          <h3 className="font-bold text-[#7fff00] mb-2">All Quests</h3>
          <div className="space-y-2">
            {QUEST_CATALOG.map((q) => {
              const p = questProgress[q.id];
              const status = p?.status ?? "available";
              return (
                <div key={q.id} className="border border-white/10 rounded-lg p-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {q.title} {q.daily && <span className="text-[10px] text-[#ffd84d]">DAILY</span>}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {q.reward.coins}c · {q.reward.xp}xp{q.reward.badges ? ` · ${q.reward.badges}b` : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">{q.description}</p>
                  <div className="text-[10px] mt-1">
                    {status === "available" && <span className="text-gray-400">Visit the lodge to accept.</span>}
                    {status === "active" && <span className="text-[#7fff00]">Progress {p.progress}/{p.targetCount}</span>}
                    {status === "complete" && <span className="text-[#7fff00]">Complete — claim at the lodge.</span>}
                    {status === "claimed" && <span className="text-gray-500">Claimed.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
