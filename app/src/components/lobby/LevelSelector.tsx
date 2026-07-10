import type { LevelId } from "../../types";
import { LEVELS, LEVEL_ORDER, ANIMAL_DEFS } from "../../types";

interface LevelSelectorProps {
  selectedLevel: LevelId;
  onSelectLevel: (id: LevelId) => void;
  disabled?: boolean;
}

/**
 * Two level cards (Forest + The Deep Dark). Game-style cards, not a plain
 * <select>. Reused by both the desktop LobbyScene and the portrait lobby.
 */
export default function LevelSelector({
  selectedLevel,
  onSelectLevel,
  disabled = false,
}: LevelSelectorProps) {
  return (
    <div
      className="w-full rounded-2xl border-2 border-[#8b5c1e] p-3"
      style={{ background: "linear-gradient(135deg, #3d2210cc 0%, #1a0f05cc 100%)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#f5d07a] font-bold text-xs uppercase tracking-wider">
          Choose Level
        </span>
        <span className="text-[#9a7a3a] text-[10px]">{LEVEL_ORDER.length} maps</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {LEVEL_ORDER.map((id) => {
          const level = LEVELS[id];
          const active = selectedLevel === id;
          const isOcean = level.biome === "ocean";
          const isSavannah = level.biome === "savannah";
          const accent = isOcean ? "#39c0e6" : isSavannah ? "#f0a83a" : "#5fd030";
          const icon = isOcean ? "🌊" : isSavannah ? "🌾" : "🌳";
          const bannerBg = isOcean
            ? "linear-gradient(180deg,#0b3a5a,#123f6e)"
            : isSavannah
              ? "linear-gradient(180deg,#7a4f16,#a5702a)"
              : "linear-gradient(180deg,#1a3a08,#2f5a14)";
          const preview = level.allowedAnimals.slice(0, 4);

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!disabled) onSelectLevel(id);
              }}
              disabled={disabled}
              className={[
                "relative flex flex-col gap-1.5 rounded-xl border-2 p-2.5 text-left transition-all duration-150 select-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[" + accent + "]",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110 active:scale-[0.98]",
                active
                  ? "bg-[#14223a] shadow-[0_0_14px_2px_" + accent + "66]"
                  : "bg-[#2a1808]/70 border-[#5a3a1a]",
              ].join(" ")}
              style={{
                borderColor: active ? accent : "#5a3a1a",
                touchAction: "manipulation",
              }}
            >
              {/* Banner gradient header */}
              <div
                className="absolute inset-x-0 top-0 h-8 rounded-t-xl pointer-events-none"
                style={{ background: bannerBg }}
              />
              <div className="relative flex items-center gap-1.5 pt-1">
                <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
                <span
                  className="font-extrabold text-[13px] leading-tight"
                  style={{ color: active ? "#fff" : "#f5d07a" }}
                >
                  {level.displayName}
                </span>
                {active && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: accent, color: "#06121f" }}>
                    SELECTED
                  </span>
                )}
              </div>

              <p className="relative text-[9.5px] leading-snug text-[#cdb88a]">
                {level.subtitle}
              </p>

              {/* Morph preview row */}
              <div className="relative flex gap-1 mt-0.5">
                {preview.map((a) => {
                  const def = ANIMAL_DEFS[a];
                  const isPng = !def.ocean && !def.savannah;
                  return (
                    <div
                      key={a}
                      className="w-6 h-6 rounded-md flex items-center justify-center border"
                      style={{
                        borderColor: "#3a2a14",
                        background: isPng ? "rgba(255,255,255,0.06)" : `radial-gradient(circle at 50% 35%, ${def.color}, #06121f)`,
                      }}
                    >
                      {isPng ? (
                        <img
                          src={`/assets/${a}.png`}
                          alt={def.label}
                          className="w-5 h-5 object-contain"
                          style={{ imageResolution: "pixelated", imageRendering: "pixelated" }}
                        />
                      ) : (
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{def.emoji}</span>
                      )}
                    </div>
                  );
                })}
                {level.allowedAnimals.length > 4 && (
                  <span className="text-[9px] text-[#8a7a4a] self-center ml-0.5">
                    +{level.allowedAnimals.length - 4}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {disabled && (
        <p className="text-[#9a7a3a] text-[10px] mt-2">
          Level can only be changed in the lobby.
        </p>
      )}
    </div>
  );
}
