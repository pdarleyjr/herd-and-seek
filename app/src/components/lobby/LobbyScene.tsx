import { useState } from "react";
import LobbyBackground from "./LobbyBackground";
import SvgTree from "./SvgTree";
import HerdSeekLogo from "./HerdSeekLogo";
import MorphPanel from "./MorphPanel";
import LevelSelector from "./LevelSelector";
import UpgradePanel from "./UpgradePanel";
import PlayerStatusBar from "./PlayerStatusBar";
import ReadyButton from "./ReadyButton";
import HowToPlayModal from "./HowToPlayModal";
import PortraitLobby from "./PortraitLobby";
import AnimalThumb from "../../ui/AnimalThumb";
import { useViewportInfo } from "../../hooks/useViewportInfo";
import type { SerializedState, AnimalType, PerkType, LevelId } from "../../types";
import { LEVELS, ANIMAL_DEFS, animalsForLevel } from "../../types";

const DURATION_PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
];

interface LobbySceneProps {
  username: string;
  userId: string;
  gameState: SerializedState | null;
  connected: boolean;
  selectedAnimal: AnimalType;
  selectedPerk: PerkType;
  selectedLevel: LevelId;
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onSelectLevel: (l: LevelId) => void;
  onSetDuration: (seconds: number) => void;
  onReady: () => void;
  onStartSolo?: () => void;
  onSoloWithBots?: (role: "hunter" | "animal" | "random", botCount: number) => void;
  onOpenWorld?: () => void;
}

export default function LobbyScene({
  username,
  userId,
  gameState,
  connected,
  selectedAnimal,
  selectedPerk,
  selectedLevel,
  onSelectAnimal,
  onSelectPerk,
  onSelectLevel,
  onSetDuration,
  onReady,
  onStartSolo,
  onSoloWithBots,
  onOpenWorld,
}: LobbySceneProps) {
  const { layoutMode, isPhone } = useViewportInfo();
  const [soloOpen, setSoloOpen] = useState(false);

  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;
  const playerCount = gameState?.players.length ?? 0;
  const allReady = playerCount >= 2 && (gameState?.players.every((p) => p.isReady) ?? false);
  const canStart = allReady;

  const inGame = gameState?.phase === "PLAYING";
  const allowedAnimals = animalsForLevel(selectedLevel);
  const isLandscapeTablet = layoutMode === "tablet-landscape";

  // Phones and tablet portrait: use vertical tab layout instead of the full grid.
  if (isPhone || layoutMode === "tablet-portrait") {
    return (
      <PortraitLobby
        username={username}
        userId={userId}
        gameState={gameState}
        connected={connected}
        selectedAnimal={selectedAnimal}
        selectedPerk={selectedPerk}
        selectedLevel={selectedLevel}
        onSelectAnimal={onSelectAnimal}
        onSelectPerk={onSelectPerk}
        onSelectLevel={onSelectLevel}
        onSetDuration={onSetDuration}
        onReady={onReady}
        onStartSolo={onStartSolo}
        onSoloWithBots={onSoloWithBots}
        onOpenWorld={onOpenWorld}
        compact={isPhone || layoutMode === "tablet-portrait"}
      />
    );
  }

  const level = LEVELS[selectedLevel];
  const animalDef = ANIMAL_DEFS[selectedAnimal];
  const biomeTint =
    level.biome === "ocean"
      ? "radial-gradient(120% 80% at 50% 0%, rgba(57,192,230,0.25), transparent 60%)"
      : level.biome === "savannah"
        ? "radial-gradient(120% 80% at 50% 0%, rgba(240,168,58,0.25), transparent 60%)"
        : "radial-gradient(120% 80% at 50% 0%, rgba(127,255,0,0.18), transparent 60%)";

  return (
    <div className="relative w-dvw h-dvh overflow-hidden select-none" style={{ touchAction: "none" }}>
      <LobbyBackground />

      <div
        className="absolute inset-0 grid gap-3 p-3 sm:p-4"
        style={{
          gridTemplateAreas: `"header header header" "setup preview upgrades" "footer footer footer"`,
          gridTemplateColumns: isLandscapeTablet
            ? "minmax(240px,300px) minmax(280px,1fr) minmax(240px,300px)"
            : "minmax(280px,340px) minmax(320px,1fr) minmax(300px,360px)",
          gridTemplateRows: "auto minmax(0,1fr) auto",
          minHeight: 0,
        }}
      >
        {/* Header: logo + profile */}
        <header className="flex items-start justify-between gap-3" style={{ gridArea: "header" }}>
          <HerdSeekLogo />
          <PlayerStatusBar username={username} gameState={gameState} userId={userId} connected={connected} />
        </header>

        {/* Setup rail */}
        <section
          className="flex flex-col gap-3 min-h-0 overflow-y-auto scroll-area"
          style={{ gridArea: "setup" }}
        >
          <LevelSelector selectedLevel={selectedLevel} onSelectLevel={onSelectLevel} disabled={inGame} />
          <MorphPanel
            selected={selectedAnimal}
            onSelect={onSelectAnimal}
            disabled={inGame}
            allowedAnimals={allowedAnimals}
            levelId={selectedLevel}
          />
        </section>

        {/* Center preview */}
        <section
          className="game-panel relative flex flex-col items-center justify-center text-center overflow-hidden min-h-0 p-4"
          style={{ gridArea: "preview", background: `linear-gradient(180deg,#2e1a08,#160c05), ${biomeTint}` }}
        >
          {level.biome === "forest" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-50 pointer-events-none" style={{ width: "clamp(120px,18vw,240px)" }}>
              <SvgTree className="w-full h-auto" />
            </div>
          )}
          <div className="relative mb-2">
            <AnimalThumb animal={selectedAnimal} size={160} animated />
          </div>
          <h2 className="relative text-xl font-extrabold text-[#f5d07a]" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            {animalDef?.label ?? selectedAnimal}
          </h2>
          <p className="relative text-sm text-[#d8c39a] max-w-[38ch]">{animalDef?.description}</p>
          <div className="relative mt-3 status-pill status-pill--ok">{level.displayName}</div>
        </section>

        {/* Upgrades rail */}
        <section className="min-h-0 min-w-0" style={{ gridArea: "upgrades" }}>
          <UpgradePanel selected={selectedPerk} onSelect={onSelectPerk} disabled={inGame} />
        </section>

        {/* Footer: party | mode | action */}
        <footer className="flex items-end gap-3" style={{ gridArea: "footer", minHeight: 0 }}>
          {/* Left: party + help */}
          <div className="flex items-end gap-2 flex-wrap min-w-0">
            <HowToPlayModal />
            <PlayerList gameState={gameState} userId={userId} />
          </div>

          {/* Center: primary entry points */}
          <div className="mx-auto flex items-center gap-2 flex-wrap justify-center">
            <ReadyButton
              isReady={isReady}
              canStart={canStart}
              allReady={allReady}
              playerCount={playerCount}
              onReady={onReady}
              isHost={me?.id === gameState?.players[0]?.id}
            />
            <button
              type="button"
              onClick={() => setSoloOpen((v) => !v)}
              aria-expanded={soloOpen}
              className={`game-button game-button--gold ${soloOpen ? "is-selected" : ""}`}
            >
              🎮 Solo vs AI
            </button>
            {onOpenWorld && (
              <button
                type="button"
                onClick={() => onOpenWorld()}
                className="game-button game-button--savannah min-h-[56px] px-5 text-base"
              >
                🌍 Open World
              </button>
            )}
          </div>

          {/* Right: contextual controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
            {soloOpen ? (
              <SoloBotSelector onStartSolo={onStartSolo} onSoloWithBots={onSoloWithBots} />
            ) : (
              <GameModeInfo
                matchDuration={gameState?.matchDuration ?? 120}
                mapName={level.displayName}
                onSetDuration={onSetDuration}
                disabled={inGame}
              />
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-components ──

function PlayerList({
  gameState,
  userId,
}: {
  gameState: SerializedState | null;
  userId: string;
}) {
  const players = gameState?.players ?? [];
  if (players.length === 0) return null;

  return (
    <div className="game-panel px-3 py-2 min-w-0">
      <div className="text-[#f5d07a] font-bold text-xs uppercase tracking-wider mb-1.5">
        Players ({players.length})
      </div>
      <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scroll-area">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className={`text-[10px] w-2 h-2 rounded-full inline-block ${p.isReady ? "bg-[#7fff00]" : "bg-[#888]"}`} />
            <span className={`text-xs truncate max-w-[130px] ${p.id === userId ? "text-[#7fff00] font-bold" : "text-[#e8c87a]"}`}>
              {p.username}{p.id === userId ? " (You)" : ""}
            </span>
            <span className="text-[10px] text-[#888] ml-auto">{p.isReady ? "✓" : "..."}</span>
          </div>
        ))}
      </div>
      {players.length < 2 && (
        <p className="text-[#f5a020] text-[10px] mt-1.5">Waiting for more players...</p>
      )}
    </div>
  );
}

function GameModeInfo({
  matchDuration,
  mapName,
  onSetDuration,
  disabled,
}: {
  matchDuration: number;
  mapName: string;
  onSetDuration: (s: number) => void;
  disabled: boolean;
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${m}:00` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const isPreset = DURATION_PRESETS.some((p) => p.seconds === matchDuration);

  const applyCustom = () => {
    const raw = customInput.trim().toLowerCase();
    let total = 0;
    const mMatch = raw.match(/(\d+)\s*m(?:in)?/);
    const sMatch = raw.match(/(\d+)\s*s(?:ec)?/);
    const colonMatch = raw.match(/^(\d+):(\d+)$/);
    const plainMatch = raw.match(/^(\d+)$/);
    if (colonMatch) {
      total = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    } else if (mMatch || sMatch) {
      total = (mMatch ? parseInt(mMatch[1]) * 60 : 0) + (sMatch ? parseInt(sMatch[1]) : 0);
    } else if (plainMatch) {
      const n = parseInt(plainMatch[1]);
      total = n <= 60 ? n * 60 : n;
    }
    if (total >= 30 && total <= 3600) {
      onSetDuration(total);
      setCustomMode(false);
      setCustomInput("");
    }
  };

  return (
    <div className="game-panel px-3 py-2 text-right">
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Mode</span>
        <span className="text-[#f5d07a] text-xs font-bold">Stealth Hunt</span>
      </div>
      <div className="flex items-center gap-2 justify-end mt-0.5">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Map</span>
        <span className="text-[#f5d07a] text-xs font-bold">{mapName}</span>
      </div>
      <div className="mt-2 border-t border-[#6b3a0a] pt-2">
        <div className="flex items-center justify-end gap-2 mb-1.5">
          <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Match Time</span>
          <span className="text-[#f5d07a] text-sm font-extrabold tabular-nums">{fmt(matchDuration)}</span>
        </div>
        {!disabled && (
          <>
            <div className="flex flex-wrap gap-1 justify-end mb-1.5">
              {DURATION_PRESETS.map((p) => {
                const active = p.seconds === matchDuration;
                return (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => { onSetDuration(p.seconds); setCustomMode(false); }}
                    className={[
                      "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all duration-100 select-none min-h-[28px]",
                      active
                        ? "border-[#7fff00] bg-[#1a3a08] text-[#7fff00]"
                        : "border-[#6b3a0a] bg-[#2a1808]/80 text-[#e8c87a] hover:border-[#a07030]",
                    ].join(" ")}
                    style={{ touchAction: "manipulation" }}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomMode((v) => !v)}
                className={[
                  "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all duration-100 select-none min-h-[28px]",
                  !isPreset || customMode
                    ? "border-[#7fff00] bg-[#1a3a08] text-[#7fff00]"
                    : "border-[#6b3a0a] bg-[#2a1808]/80 text-[#e8c87a] hover:border-[#a07030]",
                ].join(" ")}
                style={{ touchAction: "manipulation" }}
              >
                Custom
              </button>
            </div>
            {customMode && (
              <div className="flex gap-1 justify-end items-center">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  placeholder="e.g. 4m, 2:30, 90"
                  className="w-28 px-2 py-1 rounded-lg bg-[#1a0f05] border border-[#8b5c1e] text-[#f5d07a] text-xs placeholder-[#6b4a2a] focus:outline-none focus:border-[#7fff00]"
                  autoFocus
                  style={{ touchAction: "manipulation" }}
                />
                <button
                  type="button"
                  onClick={applyCustom}
                  className="px-2 py-1 rounded-lg bg-[#7fff00] text-black text-xs font-bold active:scale-95 select-none min-h-[28px]"
                  style={{ touchAction: "manipulation" }}
                >
                  Set
                </button>
              </div>
            )}
            <p className="text-[#6b4a2a] text-[10px] mt-1 text-right">30s – 60m allowed</p>
          </>
        )}
      </div>
    </div>
  );
}

function SoloBotSelector({
  onStartSolo,
  onSoloWithBots,
}: {
  onStartSolo?: () => void;
  onSoloWithBots?: (role: "hunter" | "animal" | "random", botCount: number) => void;
}) {
  const [botCount, setBotCount] = useState(4);
  const [soloRole, setSoloRole] = useState<"hunter" | "animal" | "random">("random");

  return (
    <div className="game-panel p-3 flex flex-col gap-2 min-w-[220px]">
      <div className="flex items-center justify-between">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Bots</span>
        <span className="text-[#f5d07a] text-sm font-bold">{botCount}</span>
      </div>
      <div className="flex gap-1">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setBotCount(n)}
            className="flex-1 py-1 rounded-lg text-xs font-bold border select-none min-h-[36px]"
            style={{
              borderColor: n === botCount ? "#7fff00" : "#5a3a1a",
              background: n === botCount ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
              color: n === botCount ? "#7fff00" : "#e8c87a",
              touchAction: "manipulation",
            }}
          >{n}</button>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {(["hunter", "random", "animal"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSoloRole(r)}
            className="flex-1 py-1 rounded-lg text-xs font-bold border select-none min-h-[36px]"
            style={{
              borderColor: r === soloRole ? "#7fff00" : "#5a3a1a",
              background: r === soloRole ? "rgba(127,255,0,0.15)" : "rgba(42,24,8,0.8)",
              color: r === soloRole ? "#7fff00" : "#e8c87a",
              touchAction: "manipulation",
            }}
          >{r === "hunter" ? "🎯 H" : r === "animal" ? "🐾 A" : "🎲 ?"}</button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          if (onSoloWithBots) onSoloWithBots(soloRole, botCount);
          else if (onStartSolo) onStartSolo();
        }}
        className="game-button game-button--gold w-full min-h-[44px]"
      >🎮 Start Solo</button>
    </div>
  );
}
