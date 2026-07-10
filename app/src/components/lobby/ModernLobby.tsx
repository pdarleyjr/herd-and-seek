import { useState } from "react";
import type { SerializedState, AnimalType, PerkType, LevelId, MatchMode } from "../../types";
import { LEVELS, LEVEL_ORDER, ANIMAL_DEFS, PERK_OPTIONS, animalsForLevel } from "../../types";
import type { ConnectionStatus } from "../../types";

interface ModernLobbyProps {
  username: string;
  userId: string;
  gameState: SerializedState | null;
  connectionStatus: ConnectionStatus;
  roomCode: string;
  isHost: boolean;
  level: number;
  coins: number;
  mode: MatchMode;
  selectedAnimal: AnimalType;
  selectedPerk: PerkType;
  selectedLevel: LevelId;
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onSelectLevel: (l: LevelId) => void;
  onReady: () => void;
  onCopyCode: () => void;
  onLeave: () => void;
  onCloseRoom: () => void;
  onOpenWorld: () => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  failed: "Connection failed",
};
const STATUS_COLOR: Record<ConnectionStatus, string> = {
  idle: "bg-gray-500",
  connecting: "bg-yellow-500",
  connected: "bg-green-500",
  reconnecting: "bg-yellow-500",
  disconnected: "bg-red-500",
  failed: "bg-red-600",
};

export default function ModernLobby(props: ModernLobbyProps) {
  const {
    username, userId, gameState, connectionStatus, roomCode, isHost,
    level, coins, mode, selectedAnimal, selectedPerk, selectedLevel,
    onSelectAnimal, onSelectPerk, onSelectLevel, onReady, onCopyCode,
    onLeave, onCloseRoom, onOpenWorld,
  } = props;

  const [copied, setCopied] = useState(false);
  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;
  const playerCount = gameState?.players.length ?? 0;
  const allowedAnimals = animalsForLevel(selectedLevel);
  const humans = (gameState?.players ?? []).filter((p) => !p.isBot);

  const readyCount = humans.filter((p) => p.isReady).length;
  let readyReason: string;
  if (playerCount < 2) readyReason = "Waiting for one more player…";
  else if (readyCount < humans.length) {
    const pending = humans.filter((p) => !p.isReady).map((p) => p.username);
    readyReason = `Waiting for ${pending.join(", ")} to ready up`;
  } else readyReason = "Everyone ready — starting soon!";

  const copy = () => {
    try {
      navigator.clipboard?.writeText(roomCode);
    } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopyCode();
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/30">
        <div className="text-xl font-extrabold tracking-tight">🦓 Herd&nbsp;&amp;&nbsp;Seek</div>
        {mode === "multiplayer" && (
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
            <span className="text-xs uppercase text-white/60">Room</span>
            <span className="font-mono font-bold tracking-widest text-emerald-300">{roomCode}</span>
            <button onClick={copy} className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 min-h-[32px]">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        {mode === "multiplayer" && (
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[connectionStatus]}`} />
            <span className="text-xs text-white/70">{STATUS_LABEL[connectionStatus]}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="px-2 py-1 rounded bg-white/10">Lv {level}</span>
          <span className="px-2 py-1 rounded bg-white/10">🪙 {coins}</span>
          <span className="font-semibold">{username}</span>
          {mode === "multiplayer" && isHost && <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-500/80">Host</span>}
          <button onClick={onLeave} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 min-h-[40px]">Leave</button>
          {mode === "multiplayer" && isHost && (
            <button onClick={onCloseRoom} className="px-3 py-1.5 rounded bg-red-700/80 hover:bg-red-600 min-h-[40px]">Close Room</button>
          )}
        </div>
      </header>

      {/* ── Main body ── */}
      {mode === "multiplayer" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_1fr] gap-4 p-4 min-h-0">
          {/* Map / Mode */}
          <section className="bg-black/20 rounded-2xl p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-bold uppercase text-emerald-300 mb-2">Choose a Map</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              {LEVEL_ORDER.map((id) => {
                const lvl = LEVELS[id];
                const active = selectedLevel === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectLevel(id)}
                    className={`text-left rounded-xl p-3 border-2 transition min-h-[64px] ${
                      active ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-bold text-base">{lvl.displayName}</div>
                    <div className="text-xs text-white/60">{lvl.subtitle}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-white/50">{LEVELS[selectedLevel].description}</p>
            <button
              onClick={onOpenWorld}
              className="mt-auto rounded-xl px-4 py-3 bg-sky-700/70 hover:bg-sky-600 text-sm font-semibold min-h-[48px]"
            >
              🌍 Enter Open World (Savannah Reserve)
            </button>
          </section>

          {/* Character preview */}
          <section className="bg-black/20 rounded-2xl p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-bold uppercase text-emerald-300 mb-2">Your Animal</h2>
            <div className="flex items-center gap-4 mb-3">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shrink-0"
                style={{ background: ANIMAL_DEFS[selectedAnimal]?.color ?? "#444" }}
              >
                {ANIMAL_DEFS[selectedAnimal]?.emoji ?? "❓"}
              </div>
              <div>
                <div className="text-lg font-bold">{ANIMAL_DEFS[selectedAnimal]?.label ?? selectedAnimal}</div>
                <div className="text-xs text-white/60">{ANIMAL_DEFS[selectedAnimal]?.description ?? ""}</div>
              </div>
            </div>
            <div className="overflow-y-auto min-h-0 grid grid-cols-3 sm:grid-cols-4 gap-2 pr-1">
              {allowedAnimals.map((a) => {
                const def = ANIMAL_DEFS[a];
                const active = selectedAnimal === a;
                return (
                  <button
                    key={a}
                    onClick={() => onSelectAnimal(a)}
                    className={`flex flex-col items-center rounded-xl p-2 border-2 transition min-h-[88px] ${
                      active ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-3xl" style={{ filter: active ? "none" : "grayscale(0.2)" }}>{def?.emoji}</span>
                    <span className="text-[11px] mt-1 text-center leading-tight">{def?.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Perks */}
          <section className="bg-black/20 rounded-2xl p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-bold uppercase text-emerald-300 mb-2">Perk Loadout</h2>
            <div className="overflow-y-auto min-h-0 flex flex-col gap-2 pr-1">
              {PERK_OPTIONS.map((p) => {
                const active = selectedPerk === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => onSelectPerk(p.value)}
                    className={`text-left rounded-xl p-3 border-2 transition min-h-[64px] ${
                      active ? "border-amber-400 bg-amber-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold">{p.emoji} {p.label}</div>
                    <div className="text-xs text-white/60">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {mode === "solo" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 p-4 min-h-0">
          <section className="bg-black/20 rounded-2xl p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-bold uppercase text-emerald-300 mb-2">Solo Setup</h2>
            <p className="text-xs text-white/60">Practice alone against AI. Choose your role, map, and bot count.</p>
          </section>
          <section className="bg-black/20 rounded-2xl p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-bold uppercase text-emerald-300 mb-2">Your Animal</h2>
            <div className="flex items-center gap-4 mb-3">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shrink-0"
                style={{ background: ANIMAL_DEFS[selectedAnimal]?.color ?? "#444" }}
              >
                {ANIMAL_DEFS[selectedAnimal]?.emoji ?? "❓"}
              </div>
              <div>
                <div className="text-lg font-bold">{ANIMAL_DEFS[selectedAnimal]?.label ?? selectedAnimal}</div>
                <div className="text-xs text-white/60">{ANIMAL_DEFS[selectedAnimal]?.description ?? ""}</div>
              </div>
            </div>
            <div className="overflow-y-auto min-h-0 grid grid-cols-3 sm:grid-cols-4 gap-2 pr-1">
              {allowedAnimals.map((a) => {
                const def = ANIMAL_DEFS[a];
                const active = selectedAnimal === a;
                return (
                  <button
                    key={a}
                    onClick={() => onSelectAnimal(a)}
                    className={`flex flex-col items-center rounded-xl p-2 border-2 transition min-h-[88px] ${
                      active ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-3xl" style={{ filter: active ? "none" : "grayscale(0.2)" }}>{def?.emoji}</span>
                    <span className="text-[11px] mt-1 text-center leading-tight">{def?.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ── Footer: roster + settings + ready ── */}
      {mode === "multiplayer" && (
        <footer className="border-t border-white/10 bg-black/30 p-3 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-xs uppercase text-white/50 mb-1">Players ({humans.length})</h3>
            <div className="flex flex-wrap gap-2">
              {humans.length === 0 && <span className="text-xs text-white/40">No players yet</span>}
              {humans.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm">
                  {p.id === gameState?.hostUserId && <span className="text-amber-400" title="Host">★</span>}
                  <span className="font-medium">{p.username}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.isReady ? "bg-green-600" : "bg-gray-600"}`}>
                    {p.isReady ? "Ready" : "Not ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/60 max-w-[260px]">{readyReason}</div>

          <button
            onClick={onReady}
            className={`px-6 py-3 rounded-xl font-bold text-base min-h-[56px] min-w-[160px] ${
              isReady ? "bg-gray-600 hover:bg-gray-500" : "bg-emerald-500 hover:bg-emerald-400 text-black"
            }`}
          >
            {isReady ? "Unready" : "Ready Up"}
          </button>
        </footer>
      )}
    </div>
  );
}
