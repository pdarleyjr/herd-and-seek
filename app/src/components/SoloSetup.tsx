import { useState } from "react";
import type { LevelId } from "../types";
import { LEVELS, LEVEL_ORDER } from "../types";

interface SoloSetupProps {
  onStart: (role: "hunter" | "animal" | "random", botCount: number, level: LevelId) => void;
  onBack: () => void;
}

const ROLES: { value: "hunter" | "animal" | "random"; label: string; emoji: string }[] = [
  { value: "hunter", label: "Hunter", emoji: "🎯" },
  { value: "animal", label: "Animal", emoji: "🐾" },
  { value: "random", label: "Random", emoji: "🎲" },
];

export default function SoloSetup({ onStart, onBack }: SoloSetupProps) {
  const [role, setRole] = useState<"hunter" | "animal" | "random">("random");
  const [botCount, setBotCount] = useState(4);
  const [level, setLevel] = useState<LevelId>("forest");

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-extrabold">Solo vs AI</h1>

      <div className="w-full max-w-md rounded-2xl p-5 border-2 border-white/10 bg-white/5 flex flex-col gap-4">
        <div>
          <div className="text-sm font-bold uppercase text-emerald-300 mb-2">Your Role</div>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`rounded-xl p-3 border-2 transition min-h-[72px] ${role === r.value ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5"}`}
              >
                <div className="text-2xl">{r.emoji}</div>
                <div className="text-xs mt-1">{r.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-bold uppercase text-emerald-300 mb-2">Map</div>
          <div className="grid grid-cols-3 gap-2">
            {LEVEL_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => setLevel(id)}
                className={`rounded-xl p-3 border-2 transition min-h-[64px] ${level === id ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5"}`}
              >
                <div className="text-sm font-semibold">{LEVELS[id].displayName}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-bold uppercase text-emerald-300 mb-2">Bot Count: {botCount}</div>
          <input
            type="range"
            min={1}
            max={12}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-white/50"><span>1</span><span>12</span></div>
        </div>

        <button
          onClick={() => onStart(role, botCount, level)}
          className="w-full rounded-xl px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold min-h-[56px]"
        >
          Start Solo Match
        </button>
        <button onClick={onBack} className="text-sm text-white/60 underline self-center">← Back</button>
      </div>
    </div>
  );
}
