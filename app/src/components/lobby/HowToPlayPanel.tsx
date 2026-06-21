import { useState } from "react";

interface HowToPlayPanelProps {
  collapsed?: boolean; // start collapsed on mobile
}

const RULES = [
  { icon: "🐾", title: "Animals — Survive", text: "Blend in with the NPC herd. Stand still or mimic NPC movement. Avoid the hunter for the full timer to win." },
  { icon: "🎯", title: "Hunter — Track & Tag", text: "Find the real players hiding among the animals. Tap to aim, press FIRE to shoot. Run out of ammo and the animals win." },
  { icon: "🦓", title: "Morphs", text: "Pick your animal disguise before the match. Choose one that matches the NPC herd to blend in better." },
  { icon: "⚡", title: "Upgrades", text: "Sprint: speed burst. Camouflage: freeze & disappear. Extra Life: survive one hit. Decoy: drop a copy. Speed Boost: always faster." },
  { icon: "🌿", title: "Hiding Spots", text: "Stand inside tall grass patches to get the HIDDEN status. Hidden animals are harder to spot. Moving while hidden reduces the benefit." },
  { icon: "📱", title: "Mobile Controls", text: "Animals: left joystick to move, Shift button to use upgrade. Hunter: left joystick moves, drag right side to aim, tap FIRE button to shoot." },
  { icon: "🔴", title: "Hunter Radar", text: "The hunter minimap pulses red every 5 seconds revealing all animal positions. Use that window to hunt — then positions go dark again." },
];

export default function HowToPlayPanel({ collapsed = false }: HowToPlayPanelProps) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div
      className="rounded-2xl border-2 border-[#5a3010] overflow-hidden"
      style={{ background: "rgba(20,10,2,0.88)" }}
    >
      {/* Header toggle */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between px-4 py-3 select-none"
        style={{ touchAction: "manipulation" }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="text-[#f5d07a] font-bold text-sm uppercase tracking-wider">
            How to Play
          </span>
        </div>
        <span className="text-[#c8a05a] text-lg leading-none">{open ? "▲" : "▼"}</span>
      </button>

      {/* Content */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-[#3d2010]">
          {RULES.map((rule) => (
            <div
              key={rule.title}
              className="flex gap-3 items-start py-2 border-b border-[#2a1808] last:border-b-0"
            >
              <span className="text-xl shrink-0 mt-0.5">{rule.icon}</span>
              <div>
                <div className="text-[#f5d07a] font-bold text-xs mb-0.5">{rule.title}</div>
                <div className="text-[#c8a05a] text-[11px] leading-relaxed">{rule.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
