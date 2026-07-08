import WoodPanel from "./WoodPanel";
import type { AnimalType, LevelId } from "../../types";
import { ANIMAL_DEFS } from "../../types";

interface MorphPanelProps {
  selected: AnimalType;
  onSelect: (a: AnimalType) => void;
  disabled?: boolean;
  allowedAnimals?: AnimalType[];
  levelId?: LevelId;
  dense?: boolean;
}

function levelSubtitle(levelId?: LevelId): string {
  if (!levelId) return "Choose your disguise";
  return levelId === "deepDark" ? "Choose your ocean disguise" : "Choose your forest disguise";
}

export default function MorphPanel({
  selected,
  onSelect,
  disabled = false,
  allowedAnimals,
  levelId,
  dense = false,
}: MorphPanelProps) {
  // Default to the full forest-friendly roster if no level provided (keeps
  // legacy callers safe). Otherwise render only the selected level's morphs.
  const list: AnimalType[] = allowedAnimals && allowedAnimals.length
    ? allowedAnimals
    : (["rabbit", "bear", "owl", "snake", "frog", "duck", "dog", "panda"] as AnimalType[]);

  return (
    <WoodPanel title="Morphs" subtitle={levelSubtitle(levelId)} className="h-full">
      <div className={`grid ${dense ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
        {list.map((value) => {
          const def = ANIMAL_DEFS[value];
          const isSelected = value === selected;
          return (
            <button
              key={value}
              aria-pressed={isSelected}
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!disabled) onSelect(value);
              }}
              title={def.description ?? def.label}
              className={[
                "flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-all duration-150 select-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fff00]",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                isSelected
                  ? "border-[#7fff00] bg-[#1a3a08]/80 shadow-[0_0_12px_2px_rgba(127,255,0,0.4)] scale-[1.04]"
                  : "border-[#5a3a1a] bg-[#2a1808]/70 hover:border-[#a07030] hover:bg-[#3a2010]/70 active:scale-95",
              ].join(" ")}
            >
              {def.ocean ? (
                // No PNG sprite for ocean animals — render a colored disc with emoji.
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-[#0c2233]"
                  style={{
                    background: `radial-gradient(circle at 42% 32%, #ffffff33, ${def.color ?? "#3890c0"} 70%, #06121f)`,
                    fontSize: 18,
                  }}
                >
                  {def.emoji}
                </div>
              ) : (
                <img
                  src={`/assets/${value}.png`}
                  alt={def.label}
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
              <span className="text-[10px] font-semibold text-[#e8c87a] leading-tight text-center">
                {def.label}
              </span>
              {isSelected && (
                <span className="text-[#7fff00] text-[9px] font-bold">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </WoodPanel>
  );
}
