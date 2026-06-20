import type { SerializedState } from "../../types";

interface PlayerStatusBarProps {
  username: string;
  gameState: SerializedState | null;
  userId: string;
  connected: boolean;
}

export default function PlayerStatusBar({ username, gameState, userId, connected }: PlayerStatusBarProps) {
  const readyCount = gameState?.players.filter((p) => p.isReady).length ?? 0;
  const totalCount = gameState?.players.length ?? 0;
  const me = gameState?.players.find((p) => p.id === userId);
  const isReady = me?.isReady ?? false;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border-2 border-[#8b5c1e] px-4 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.6)]"
      style={{ background: "linear-gradient(135deg, #3d2210 0%, #1a0f05 100%)" }}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full border-2 border-[#f5d07a] bg-[#2a1808] flex items-center justify-center shrink-0 overflow-hidden">
        <span className="text-xl">{me?.animalType ? "🐾" : "👤"}</span>
      </div>

      {/* Name + status */}
      <div className="flex flex-col min-w-0">
        <span className="font-bold text-[#f5d07a] text-sm truncate max-w-[120px]">{username}</span>
        <span className={`text-xs font-semibold ${connected ? "text-[#7fff00]" : "text-red-400"}`}>
          {connected ? "● Connected" : "○ Connecting..."}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-[#8b5c1e] mx-1 shrink-0" />

      {/* Ready count */}
      <div className="flex flex-col items-center shrink-0">
        <span className="text-[#7fff00] font-extrabold text-base leading-none">
          {readyCount}/{totalCount}
        </span>
        <span className="text-[#c8a05a] text-[10px] font-semibold uppercase tracking-wide">Ready</span>
      </div>

      {/* Local ready badge */}
      {isReady && (
        <div className="bg-[#1a3a08] border border-[#7fff00] rounded-lg px-2 py-0.5 shrink-0">
          <span className="text-[#7fff00] text-xs font-bold">✓ You're Ready</span>
        </div>
      )}
    </div>
  );
}
