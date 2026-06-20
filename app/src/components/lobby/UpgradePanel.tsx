import WoodPanel from "./WoodPanel";
import type { PerkType } from "../../types";
import { PERK_OPTIONS } from "../../types";

interface UpgradePanelProps {
  selected: PerkType;
  onSelect: (p: PerkType) => void;
  disabled?: boolean;
}

export default function UpgradePanel({ selected, onSelect, disabled = false }: UpgradePanelProps) {
  return (
    <WoodPanel title="Upgrades" subtitle="Customize your advantages" className="h-full">
      <div className="flex flex-col gap-2">
        {PERK_OPTIONS.map((p) => {
          const isSelected = p.value === selected;
          return (
            <button
              key={p.value}
              aria-pressed={isSelected}
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!disabled) onSelect(p.value);
              }}
              className={[
                "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 select-none w-full",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fff00]",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                isSelected
                  ? "border-[#7fff00] bg-[#1a3a08]/80 shadow-[0_0_10px_2px_rgba(127,255,0,0.35)]"
                  : "border-[#5a3a1a] bg-[#2a1808]/70 hover:border-[#a07030] hover:bg-[#3a2010]/70 active:scale-[0.98]",
              ].join(" ")}
            >
              <span className="text-2xl shrink-0 w-8 text-center">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold text-sm ${isSelected ? "text-[#7fff00]" : "text-[#f5d07a]"}`}
                  >
                    {p.label}
                  </span>
                  {isSelected && (
                    <span className="text-[#7fff00] text-xs font-bold ml-auto">✓ Active</span>
                  )}
                </div>
                <p className="text-[11px] text-[#c8a05a] leading-tight mt-0.5 line-clamp-2">
                  {p.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </WoodPanel>
  );
}
