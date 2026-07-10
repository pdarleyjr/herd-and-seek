import type { PlayerProfile } from "../../economy";
import { levelProgress } from "../../economy";

interface ProfileBarProps {
  profile: PlayerProfile | null;
  onOpenShop: () => void;
}

// Compact wallet pill shown over the lobby: level, coins, badges + a shop entry.
export default function ProfileBar({ profile, onOpenShop }: ProfileBarProps) {
  const coins = profile?.coins ?? 0;
  const badges = profile?.badges ?? 0;
  const level = profile?.level ?? 1;
  const progress = profile ? levelProgress(profile) : 0;

  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-[#8b5c1e] px-3 py-1.5 shadow-lg"
      style={{
        background: "linear-gradient(135deg, #3d2210ee 0%, #1a0f05ee 100%)",
        touchAction: "manipulation",
      }}
    >
      <div className="flex flex-col items-center leading-none">
        <span className="text-[9px] uppercase tracking-wide text-[#c8a05a]">Lvl</span>
        <span className="text-[#f5d07a] font-extrabold text-sm">{level}</span>
      </div>
      <div className="w-14 h-1.5 rounded-full bg-black/50 overflow-hidden hidden sm:block">
        <div className="h-full bg-[#7fff00]" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="flex items-center gap-1 text-[#f5d07a] font-bold text-sm tabular-nums">
        <span>🪙</span>
        <span>{coins.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1 text-[#ffd86a] font-bold text-sm tabular-nums">
        <span>🎖</span>
        <span>{badges.toLocaleString()}</span>
      </div>
      <button
        type="button"
        onClick={onOpenShop}
        className="ml-1 px-2.5 py-1 rounded-full bg-[#7fff00] text-black text-xs font-bold active:scale-95 select-none"
        style={{ touchAction: "manipulation" }}
      >
        Shop
      </button>
    </div>
  );
}
