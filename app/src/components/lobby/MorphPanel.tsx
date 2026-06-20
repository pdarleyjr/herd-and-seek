import WoodPanel from "./WoodPanel";
import type { AnimalType } from "../../types";
import { ANIMAL_OPTIONS } from "../../types";

interface MorphPanelProps {
  selected: AnimalType;
  onSelect: (a: AnimalType) => void;
  disabled?: boolean;
}

export default function MorphPanel({ selected, onSelect, disabled = false }: MorphPanelProps) {
  return (
    <WoodPanel title="Morphs" subtitle="Choose your disguise" className="h-full">
      <div className="grid grid-cols-3 gap-2">
        {ANIMAL_OPTIONS.map((a) => {
          const isSelected = a.value === selected;
          return (
            <button
              key={a.value}
              aria-pressed={isSelected}
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!disabled) onSelect(a.value);
              }}
              className={[
                "flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-all duration-150 select-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fff00]",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                isSelected
                  ? "border-[#7fff00] bg-[#1a3a08]/80 shadow-[0_0_12px_2px_rgba(127,255,0,0.4)] scale-[1.04]"
                  : "border-[#5a3a1a] bg-[#2a1808]/70 hover:border-[#a07030] hover:bg-[#3a2010]/70 active:scale-95",
              ].join(" ")}
            >
              <img
                src={`/assets/${a.value}.png`}
                alt={a.label}
                className="w-10 h-10 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-[10px] font-semibold text-[#e8c87a] leading-tight text-center">
                {a.label}
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
