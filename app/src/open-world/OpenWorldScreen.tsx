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

  const profileReady = profile && profile.level > 0;

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

      {/* ── Top HUD: Leave | active quest | profile ── */}
      <div
        className="absolute z-30 inset-x-0 flex items-start gap-2 pointer-events-none"
        style={{ top: "max(12px, env(safe-area-inset-top))", paddingInline: "max(12px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-right))" }}
      >
        {/* Left: leave */}
        <button
          type="button"
          onClick={() => { ow.leave(); onExit(); }}
          aria-label="Leave the Savannah Reserve"
          className="game-button game-button--danger pointer-events-auto shrink-0"
        >
          ← Leave
        </button>

        {/* Center: active quest chip */}
        <div className="pointer-events-auto flex-1 min-w-0">
          {!ow.connected ? (
            <div className="game-panel inline-flex items-center gap-2 px-3 py-2 pointer-events-auto" role="status" aria-live="polite">
              <span className="text-[#7fff00] font-bold text-sm">Savannah Reserve</span>
              <span className="status-pill status-pill--muted">Connecting…</span>
            </div>
          ) : activeQuests.length === 0 ? (
            <div className="game-panel inline-flex items-center gap-2 px-3 py-2 pointer-events-auto">
              <span className="text-[#7fff00] font-bold text-sm">Savannah Reserve</span>
              <span className="text-xs text-gray-300">Go to the lodge to accept quests.</span>
            </div>
          ) : (
            <div
              className="game-panel inline-flex flex-col gap-1 px-3 py-2 max-w-full pointer-events-auto"
              role="status"
              aria-live="polite"
            >
              {activeQuests.map((q) => {
                const p = questProgress[q.id];
                const pct = Math.min(100, Math.round((p.progress / p.targetCount) * 100));
                const done = p.status === "complete";
                return (
                  <div key={q.id} className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`font-bold text-sm truncate ${done ? "text-[#7fff00]" : "text-[#f7ecd2]"}`}>{q.title}</span>
                      <span className="text-xs text-gray-300 tabular-nums shrink-0">{p.progress}/{p.targetCount}</span>
                    </div>
                    <div className="progress" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <div className="progress__fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: profile + quest toggle */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <div
            className="game-panel flex items-center gap-3 px-3 py-2"
            aria-live="polite"
            aria-label={`Profile level ${profileReady ? profile.level : "loading"}, ${profile?.coins ?? 0} coins, ${profile?.badges ?? 0} badges`}
          >
            {profileReady ? (
              <>
                <span className="font-bold text-sm">Lv {profile.level}</span>
                <span className="text-[#ffcf33] text-sm">🪙 {profile.coins}</span>
                <span className="text-[#ffd84d] text-sm">🏅 {profile.badges}</span>
              </>
            ) : (
              <span className="status-pill status-pill--muted">
                {ow.connected ? "Loading profile…" : "Offline"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            aria-label="Toggle quest list"
            className="game-button shrink-0"
          >
            {drawerOpen ? "Hide" : "Quests"}
          </button>
        </div>
      </div>

      {/* Reward toasts (live) */}
      <div className="absolute z-20 top-20 right-3 space-y-1 pointer-events-none" aria-live="polite">
        {ow.rewards.slice(0, 3).map((r, i) => (
          <div key={i} className="game-panel px-3 py-1 text-xs font-bold text-black bg-[#7fff00]">
            +{r.coins}c +{r.xp}xp{r.badges ? ` +${r.badges}b` : ""}
          </div>
        ))}
      </div>

      {/* Connection / error banner */}
      {ow.error && (
        <div className="absolute z-20 bottom-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3 py-1 rounded-full" role="alert">
          {ow.error.message}
        </div>
      )}

      {/* Collapsible quest drawer */}
      {drawerOpen && (
        <div
          className="absolute z-30 inset-x-2 bottom-2 game-panel p-3 max-h-[55vh] overflow-y-auto"
          style={{ bottom: "max(8px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}
          role="dialog"
          aria-label="All quests"
        >
          <h3 className="game-panel__title mb-2">All Quests</h3>
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
