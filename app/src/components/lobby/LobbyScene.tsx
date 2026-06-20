import LobbyBackground from "./LobbyBackground";
import SvgTree from "./SvgTree";
import HerdSeekLogo from "./HerdSeekLogo";
import MorphPanel from "./MorphPanel";
import UpgradePanel from "./UpgradePanel";
import PlayerStatusBar from "./PlayerStatusBar";
import ReadyButton from "./ReadyButton";
import type { SerializedState, AnimalType, PerkType } from "../../types";

interface LobbySceneProps {
  username: string;
  userId: string;
  gameState: SerializedState | null;
  connected: boolean;
  selectedAnimal: AnimalType;
  selectedPerk: PerkType;
  onSelectAnimal: (a: AnimalType) => void;
  onSelectPerk: (p: PerkType) => void;
  onReady: () => void;
  onStart: () => void;
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
  onReady,
  onStart,
}: LobbySceneProps) {
  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;
  const playerCount = gameState?.players.length ?? 0;
  const allReady = playerCount >= 2 && (gameState?.players.every((p) => p.isReady) ?? false);
  const canStart = allReady;

  const inGame = gameState?.phase === "PLAYING";

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

        {/* BOTTOM-LEFT: Player list */}
        <div className="pointer-events-auto flex items-end">
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

        {/* BOTTOM-RIGHT: Game mode info */}
        <div className="pointer-events-auto flex items-end justify-end">
          <GameModeInfo />
        </div>
      </div>

      {/* Central tree — absolutely positioned, z-index between bg and panels */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "8%",
          transform: "translateX(-50%)",
          width: "clamp(200px, 28vw, 360px)",
          zIndex: 0,
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
        }}
      >
        <SvgTree className="w-full h-full" />
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

function GameModeInfo() {
  return (
    <div
      className="rounded-2xl border-2 border-[#8b5c1e] px-4 py-2 text-right"
      style={{ background: "linear-gradient(135deg, #3d2210cc 0%, #1a0f05cc 100%)" }}
    >
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Mode</span>
        <span className="text-[#f5d07a] text-xs font-bold">Stealth Hunt</span>
      </div>
      <div className="flex items-center gap-2 justify-end mt-0.5">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Map</span>
        <span className="text-[#f5d07a] text-xs font-bold">Savanna</span>
      </div>
      <div className="flex items-center gap-2 justify-end mt-0.5">
        <span className="text-[#c8a05a] text-xs font-semibold uppercase tracking-wide">Time</span>
        <span className="text-[#f5d07a] text-xs font-bold">2:00</span>
      </div>
    </div>
  );
}
