import { useState } from "react";
import LobbyBackground from "./LobbyBackground";
import SvgTree from "./SvgTree";
import HerdSeekLogo from "./HerdSeekLogo";
import MorphPanel from "./MorphPanel";
import UpgradePanel from "./UpgradePanel";
import PlayerStatusBar from "./PlayerStatusBar";
import ReadyButton from "./ReadyButton";
import PortraitLobby from "./PortraitLobby";
import HowToPlayPanel from "./HowToPlayPanel";
import { useIsPortrait } from "../../hooks/useIsPortrait";
import type { SerializedState, AnimalType, PerkType } from "../../types";

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
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onSetDuration: (seconds: number) => void;
  onReady: () => void;
  onStart: () => void;
  onStartSolo?: (role: "hunter" | "animal") => void;
}

export default function LobbyScene({
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
  onStart,
  onStartSolo,
}: LobbySceneProps) {
  const isPortrait = useIsPortrait();

  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;
  const playerCount = gameState?.players.length ?? 0;
  const allReady = playerCount >= 2 && (gameState?.players.every((p) => p.isReady) ?? false);
  const canStart = allReady;

  const inGame = gameState?.phase === "PLAYING";

  // Portrait mobile: use vertical tab layout instead of 3-column grid
  if (isPortrait) {
    return (
      <PortraitLobby
        username={username}
        userId={userId}
        gameState={gameState}
        connected={connected}
        selectedAnimal={selectedAnimal}
        selectedPerk={selectedPerk}
        onSelectAnimal={onSelectAnimal}
        onSelectPerk={onSelectPerk}
        onSetDuration={onSetDuration}
        onReady={onReady}
        onStart={onStart}
        onStartSolo={onStartSolo}
      />
    );
  }

  return (
    <div className="relative w-dvw h-dvh overflow-hidden select-none" style={{ touchAction: "none" }}>
      {/* Animated canvas background */}
      <LobbyBackground />

      {/* ── Layout Grid ── */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{
          gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr) minmax(0,2fr)",
          gridTemplateRows: "auto 1fr auto auto",
          gap: "12px",
          padding: "14px",
          zIndex: 1,
        }}
      >
        {/* TOP-LEFT: Logo */}
        <div className="pointer-events-auto flex items-start">
          <HerdSeekLogo />
        </div>

        {/* TOP-CENTER: empty (tree is absolute below) */}
        <div />

        {/* TOP-RIGHT: Status bar */}
        <div className="pointer-events-auto flex items-start justify-end">
          <PlayerStatusBar
            username={username}
            gameState={gameState}
            userId={userId}
            connected={connected}
          />
        </div>

        {/* MID-LEFT: Morphs panel */}
        <div className="pointer-events-auto" style={{ minHeight: 0 }}>
          <MorphPanel
            selected={selectedAnimal}
            onSelect={onSelectAnimal}
            disabled={inGame}
          />
        </div>

        {/* MID-CENTER: empty (tree is absolute) */}
        <div />

        {/* MID-RIGHT: Upgrades panel */}
        <div className="pointer-events-auto" style={{ minHeight: 0 }}>
          <UpgradePanel
            selected={selectedPerk}
            onSelect={onSelectPerk}
            disabled={inGame}
          />
        </div>

        {/* BOTTOM-LEFT: Player list + solo + how to play */}
        <div className="pointer-events-auto flex flex-col items-start gap-2 justify-end">
          <div className="w-full max-w-[220px]">
            <HowToPlayPanel collapsed />
          </div>
          {onStartSolo && playerCount < 2 && (
            <div className="flex gap-1.5 w-full max-w-[220px]">
              <button
                onPointerDown={(e) => { e.preventDefault(); onStartSolo("hunter"); }}
                className="flex-1 py-1.5 rounded-xl font-bold text-xs select-none"
                style={{ background: "linear-gradient(180deg,#cc4020,#8c2010)", border: "1px solid #ff6040", color: "#fff", touchAction: "manipulation" }}
              >🎯 Solo Hunter</button>
              <button
                onPointerDown={(e) => { e.preventDefault(); onStartSolo("animal"); }}
                className="flex-1 py-1.5 rounded-xl font-bold text-xs select-none"
                style={{ background: "linear-gradient(180deg,#2a8c18,#185c0a)", border: "1px solid #7fff00", color: "#7fff00", touchAction: "manipulation" }}
              >🐾 Solo Animal</button>
            </div>
          )}
          <PlayerList gameState={gameState} userId={userId} />
        </div>

        {/* BOTTOM-CENTER: Ready button */}
        <div className="pointer-events-auto flex items-end justify-center pb-2">
          <ReadyButton
            isReady={isReady}
            canStart={canStart}
            allReady={allReady}
            playerCount={playerCount}
            onReady={onReady}
            onStart={onStart}
            isHost={me?.id === gameState?.players[0]?.id}
          />
        </div>

        {/* BOTTOM-RIGHT: Game mode info + duration picker */}
        <div className="pointer-events-auto flex items-end justify-end">
          <GameModeInfo
            matchDuration={gameState?.matchDuration ?? 120}
            onSetDuration={onSetDuration}
            disabled={inGame}
          />
        </div>
      </div>

      {/* Central tree — anchored to ground bottom, never floats into sky */}
      {/* bottom:38% matches the ground-line in LobbyBackground canvas (~h*0.62 from top) */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          bottom: "38%",
          transform: "translateX(-50%)",
          width: "clamp(160px, 26vw, 340px)",
          zIndex: 0,
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
        }}
      >
        <SvgTree className="w-full h-auto" />
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
    <div
      className="rounded-2xl border-2 border-[#8b5c1e] px-3 py-2 max-w-[220px] w-full"
      style={{ background: "linear-gradient(135deg, #3d2210cc 0%, #1a0f05cc 100%)" }}
    >
      <div className="text-[#f5d07a] font-bold text-xs uppercase tracking-wider mb-1.5">
        Players ({players.length})
      </div>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className={`text-[10px] w-2 h-2 rounded-full inline-block ${p.isReady ? "bg-[#7fff00]" : "bg-[#888]"}`} />
            <span
              className={`text-xs truncate max-w-[130px] ${p.id === userId ? "text-[#7fff00] font-bold" : "text-[#e8c87a]"}`}
            >
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
  onSetDuration,
  disabled,
}: {
  matchDuration: number;
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
    // Accept "1:30", "90", "1m30s", "2m" etc.
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
      // bare number: if <= 60 treat as minutes, else as seconds
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
    <div
      className="rounded-2xl border-2 border-[#8b5c1e] px-3 py-2.5 text-right w-full"
      style={{ background: "linear-gradient(135deg, #3d2210cc 0%, #1a0f05cc 100%)" }}
    >
      {/* Mode & Map rows */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Mode</span>
        <span className="text-[#f5d07a] text-xs font-bold">Stealth Hunt</span>
      </div>
      <div className="flex items-center gap-2 justify-end mt-0.5">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Map</span>
        <span className="text-[#f5d07a] text-xs font-bold">Forrest</span>
      </div>

      {/* Time row — interactive */}
      <div className="mt-2 border-t border-[#6b3a0a] pt-2">
        <div className="flex items-center justify-end gap-2 mb-1.5">
          <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Match Time</span>
          <span
            className="text-[#f5d07a] text-sm font-extrabold tabular-nums"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(matchDuration)}
          </span>
        </div>

        {!disabled && (
          <>
            {/* Preset chips */}
            <div className="flex flex-wrap gap-1 justify-end mb-1.5">
              {DURATION_PRESETS.map((p) => {
                const active = p.seconds === matchDuration;
                return (
                  <button
                    key={p.seconds}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onSetDuration(p.seconds);
                      setCustomMode(false);
                    }}
                    className={[
                      "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all duration-100 select-none",
                      active
                        ? "border-[#7fff00] bg-[#1a3a08] text-[#7fff00] shadow-[0_0_6px_rgba(127,255,0,0.35)]"
                        : "border-[#6b3a0a] bg-[#2a1808]/80 text-[#e8c87a] hover:border-[#a07030] hover:text-[#f5d07a] active:scale-95",
                    ].join(" ")}
                    style={{ touchAction: "manipulation" }}
                  >
                    {p.label}
                  </button>
                );
              })}
              {/* Custom button */}
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  setCustomMode((v) => !v);
                }}
                className={[
                  "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all duration-100 select-none",
                  !isPreset || customMode
                    ? "border-[#7fff00] bg-[#1a3a08] text-[#7fff00]"
                    : "border-[#6b3a0a] bg-[#2a1808]/80 text-[#e8c87a] hover:border-[#a07030]",
                ].join(" ")}
                style={{ touchAction: "manipulation" }}
              >
                Custom
              </button>
            </div>

            {/* Custom input row */}
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
                  onPointerDown={(e) => { e.preventDefault(); applyCustom(); }}
                  className="px-2 py-1 rounded-lg bg-[#7fff00] text-black text-xs font-bold active:scale-95 select-none"
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
