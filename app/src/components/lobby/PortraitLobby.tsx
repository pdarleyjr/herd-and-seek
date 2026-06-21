import { useState } from "react";
import MorphPanel from "./MorphPanel";
import UpgradePanel from "./UpgradePanel";
import HowToPlayPanel from "./HowToPlayPanel";
import type { SerializedState, AnimalType, PerkType } from "../../types";

type Tab = "morphs" | "upgrades" | "settings";

const DURATION_PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
];

interface PortraitLobbyProps {
  username: string;
  userId: string;
  gameState: SerializedState | null;
  connected: boolean;
  selectedAnimal: AnimalType;
  selectedPerk: PerkType;
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onSetDuration: (seconds: number) => void;
  onReady: () => void;
  onStart: () => void;
  onStartSolo?: () => void;
  onSoloWithBots?: (role: "hunter" | "animal" | "random", botCount: number) => void;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}:00` : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PortraitLobby({
  username,
  userId,
  gameState,
  connected,
  selectedAnimal,
  selectedPerk,
  onSelectAnimal,
  onSelectPerk,
  onSetDuration,
  onReady,
  onStart: _onStart,
  onStartSolo,
  onSoloWithBots,
}: PortraitLobbyProps) {
  const [tab, setTab] = useState<Tab>("morphs");
  const [soloRole, setSoloRole] = useState<"hunter" | "animal" | "random">("random");
  const [botCount, setBotCount] = useState(4);

  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;
  const playerCount = gameState?.players.length ?? 0;
  const allReady = playerCount >= 2 && (gameState?.players.every((p) => p.isReady) ?? false);
  const matchDuration = gameState?.matchDuration ?? 120;
  const inGame = gameState?.phase === "PLAYING";

  // ── Ready button state ──────────────────────────────────────────────
  const canReady = playerCount >= 2;
  let readyLabel = "Ready Up 🐾";
  let readyStyle: React.CSSProperties = {
    background: "linear-gradient(180deg,#4ecf35,#2a8c1e)",
    border: "2px solid #7fff00",
    color: "#fff",
    boxShadow: "0 0 18px rgba(127,255,0,0.4)",
  };
  if (!canReady) {
    readyLabel = `Waiting (${playerCount}/2)`;
    readyStyle = { background: "#2a2a2a", border: "2px solid #555", color: "#666" };
  } else if (isReady && allReady && me?.id === gameState?.players[0]?.id) {
    readyLabel = "🚀 Start Match!";
    readyStyle = {
      background: "linear-gradient(180deg,#f5c030,#c88010)",
      border: "2px solid #f5d07a",
      color: "#000",
      boxShadow: "0 0 18px rgba(212,160,16,0.5)",
    };
  } else if (isReady) {
    readyLabel = "✓ Ready — tap to unready";
    readyStyle = {
      background: "#1a7c10",
      border: "2px solid #7fff00",
      color: "#7fff00",
    };
  }

  return (
    <div
      className="flex flex-col overflow-hidden select-none"
      style={{
        width: "100%",
        height: "100dvh",
        background: "linear-gradient(170deg,#2a1506 0%,#0f0702 100%)",
        touchAction: "none",
      }}
    >
      {/* ─── Top header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 shrink-0 border-b border-[#5a3010]"
        style={{
          paddingTop: "max(10px, env(safe-area-inset-top, 10px))",
          paddingBottom: 10,
          background: "rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo mark */}
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontFamily: '"Arial Black", sans-serif',
              fontWeight: 900,
              fontSize: 20,
              color: "#ffe070",
              WebkitTextStroke: "3px #5c2e08",
              letterSpacing: 1,
            }}
          >
            HERD &amp; SEEK
          </div>
          <div style={{ color: "#c8a05a", fontSize: 9, letterSpacing: "0.12em" }}>
            HIDE · BLEND · SURVIVE
          </div>
        </div>

        {/* Connection + player count */}
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-bold text-[#f5d07a] text-sm">{username}</span>
          <span
            className={`text-xs font-semibold ${connected ? "text-[#7fff00]" : "text-red-400"}`}
          >
            {connected ? "● Connected" : "○ Offline"}
          </span>
          <span className="text-[#c8a05a] text-[11px]">
            {gameState?.players.filter((p) => p.isReady).length ?? 0}/{playerCount} ready
          </span>
        </div>
      </div>

      {/* ─── Tab bar ────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "2px solid #5a3010", background: "rgba(0,0,0,0.3)" }}
      >
        {(["morphs", "upgrades", "settings"] as Tab[]).map((t) => {
          const active = tab === t;
          const icons: Record<Tab, string> = { morphs: "🐾", upgrades: "⚡", settings: "⚙️" };
          const labels: Record<Tab, string> = { morphs: "Morphs", upgrades: "Upgrades", settings: "Settings" };
          return (
            <button
              key={t}
              onPointerDown={(e) => {
                e.preventDefault();
                setTab(t);
              }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 select-none transition-colors"
              style={{
                background: active ? "rgba(127,255,0,0.1)" : "transparent",
                color: active ? "#7fff00" : "#c8a05a",
                borderBottom: active ? "3px solid #7fff00" : "3px solid transparent",
                marginBottom: -2,
                touchAction: "manipulation",
              }}
            >
              <span className="text-base leading-none">{icons[t]}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide">{labels[t]}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Tab content (scrollable) ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {tab === "morphs" && (
          <div className="p-3">
            <MorphPanel selected={selectedAnimal} onSelect={onSelectAnimal} disabled={inGame} />
          </div>
        )}

        {tab === "upgrades" && (
          <div className="p-3">
            <UpgradePanel selected={selectedPerk} onSelect={onSelectPerk} disabled={inGame} />
          </div>
        )}

        {tab === "settings" && (
          <div className="p-3 flex flex-col gap-3">
            {/* Duration picker */}
            <Section title="Match Time">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">
                  Duration
                </span>
                <span className="text-[#f5d07a] text-xl font-extrabold tabular-nums">
                  {fmtTime(matchDuration)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => {
                  const active = p.seconds === matchDuration;
                  return (
                    <button
                      key={p.seconds}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        if (!inGame) onSetDuration(p.seconds);
                      }}
                      disabled={inGame}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold border select-none transition-all"
                      style={{
                        borderColor: active ? "#7fff00" : "#5a3a1a",
                        background: active ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
                        color: active ? "#7fff00" : "#e8c87a",
                        boxShadow: active ? "0 0 8px rgba(127,255,0,0.3)" : "none",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[#5a3a1a] text-[10px] mt-1">30s – 60m allowed</p>
            </Section>

            {/* Player list */}
            <Section title={`Players (${playerCount})`}>
              {playerCount === 0 && (
                <p className="text-[#666] text-sm">Waiting for connection...</p>
              )}
              {gameState?.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 py-2 border-t border-[#2a1808] first:border-t-0"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      p.isReady ? "bg-[#7fff00]" : "bg-[#555]"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold truncate flex-1 ${
                      p.id === userId ? "text-[#7fff00]" : "text-[#e8c87a]"
                    }`}
                  >
                    {p.username}
                    {p.id === userId ? " (You)" : ""}
                  </span>
                  <span className="text-[11px] text-[#888] shrink-0">
                    {p.isReady ? "✓ Ready" : "..."}
                  </span>
                </div>
              ))}
              {playerCount > 0 && playerCount < 2 && (
                <p className="text-[#f5a020] text-xs mt-2 font-semibold">
                  Need at least 2 players to start.
                </p>
              )}
            </Section>

            {/* Game info */}
            <Section title="Game Mode">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <div className="text-[#c8a05a] text-[10px] uppercase tracking-wide">Mode</div>
                  <div className="text-[#f5d07a] font-bold">Stealth Hunt</div>
                </div>
                <div>
                  <div className="text-[#c8a05a] text-[10px] uppercase tracking-wide">Map</div>
                  <div className="text-[#f5d07a] font-bold">Forrest</div>
                </div>
              </div>
            </Section>

            {/* How to Play */}
            <HowToPlayPanel collapsed />

            {/* How-to-play already shown; solo button moves to bottom bar */}
          </div>
        )}
      </div>

      // ─── Fixed bottom: Solo + Ready ───────────────────────────────
      <div
        className="shrink-0 px-4 flex flex-col gap-2"
        style={{
          paddingTop: 12,
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
          background: "rgba(0,0,0,0.55)",
          borderTop: "2px solid #3d2210",
        }}
      >
        {/* Bot count selector and role for solo mode */}
        {onStartSolo && playerCount < 2 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Bots</span>
              <span className="text-[#f5d07a] text-sm font-bold">{botCount}</span>
            </div>
            <div className="flex gap-1">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onPointerDown={(e) => { e.preventDefault(); setBotCount(n); }}
                  className="flex-1 py-1 rounded-lg text-xs font-bold border select-none"
                  style={{
                    borderColor: n === botCount ? "#7fff00" : "#5a3a1a",
                    background: n === botCount ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
                    color: n === botCount ? "#7fff00" : "#e8c87a",
                    touchAction: "manipulation",
                  }}
                >{n}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["hunter", "random", "animal"] as const).map((r) => (
                <button
                  key={r}
                  onPointerDown={(e) => { e.preventDefault(); setSoloRole(r); }}
                  className="flex-1 py-1 rounded-lg text-xs font-bold border select-none"
                  style={{
                    borderColor: r === soloRole ? "#7fff00" : "#5a3a1a",
                    background: r === soloRole ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
                    color: r === soloRole ? "#7fff00" : "#e8c87a",
                    touchAction: "manipulation",
                  }}
                >{r === "hunter" ? "🎯 Hunter" : r === "animal" ? "🐾 Animal" : "🎲 Random"}</button>
              ))}
            </div>
<button
               onPointerDown={(e) => {
                 e.preventDefault();
                 if (onSoloWithBots) onSoloWithBots(soloRole, botCount);
                 else if (onStartSolo) onStartSolo();
               }}
              className="w-full rounded-2xl font-extrabold text-base uppercase tracking-wide select-none"
              style={{
                minHeight: 52,
                background: "linear-gradient(180deg,#c8900a,#8a5e06)",
                border: "2px solid #f5c030",
                color: "#fff8dc",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                boxShadow: "0 0 16px rgba(200,144,10,0.35)",
                touchAction: "manipulation",
              }}
            >
              🎮 Play Solo vs AI
            </button>
          </div>
        )}

        {/* Multiplayer Ready button */}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            if (canReady) onReady();
          }}
          disabled={!canReady}
          className="w-full rounded-2xl font-extrabold text-lg uppercase tracking-widest transition-all select-none"
          style={{
            ...readyStyle,
            minHeight: 56,
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
            touchAction: "manipulation",
            opacity: !canReady ? 0.55 : 1,
          }}
        >
          {readyLabel}
        </button>
        {isReady && !allReady && (
          <p className="text-center text-[#c8a05a] text-xs animate-pulse">
            Waiting for others to ready up...
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helper sub-component ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border-2 border-[#5a3010] p-4"
      style={{ background: "rgba(40,18,4,0.85)" }}
    >
      <div className="text-[#f5d07a] font-bold text-xs uppercase tracking-wider mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}
