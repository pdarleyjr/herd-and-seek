import { useState } from "react";
import type { AnimalType, LevelId, PerkType, SoloDifficulty } from "../types";
import { ANIMAL_DEFS, LEVELS, LEVEL_ORDER, PERK_OPTIONS, animalsForLevel, defaultAnimalForLevel, isAnimalAllowed } from "../types";
import "./soloSetup.css";

interface SoloSetupProps {
  onStart: (settings: { role: "hunter" | "animal" | "random"; botCount: number; level: LevelId; animal: AnimalType; perk: PerkType; duration: number; difficulty: SoloDifficulty }) => void;
  onBack: () => void;
}

const ROLES = [
  { value: "hunter" as const, mark: "◎", label: "Ranger", detail: "Track the herd with limited rounds." },
  { value: "animal" as const, mark: "◇", label: "Animal", detail: "Blend in and outlast the AI ranger." },
  { value: "random" as const, mark: "?", label: "Surprise me", detail: "Let the reserve choose your role." },
];

const DIFFICULTIES: Record<SoloDifficulty, { label: string; detail: string }> = {
  easy: { label: "Easy", detail: "Slower reactions, wider misses, and generous hunter resources." },
  normal: { label: "Medium", detail: "Balanced tracking, evasion, resources, and rewards." },
  hard: { label: "Hard", detail: "Faster decisions, coordinated evasion, sharp aim, and tight resources." },
};

export default function SoloSetup({ onStart, onBack }: SoloSetupProps) {
  const [role, setRole] = useState<"hunter" | "animal" | "random">("random");
  const [botCount, setBotCount] = useState(4);
  const [level, setLevel] = useState<LevelId>("forest");
  const [animal, setAnimal] = useState<AnimalType>("rabbit");
  const [perk, setPerk] = useState<PerkType>("none");
  const [duration, setDuration] = useState(120);
  const [difficulty, setDifficulty] = useState<SoloDifficulty>("normal");

  const selectLevel = (next: LevelId) => {
    setLevel(next);
    setAnimal((current) => isAnimalAllowed(current, next) ? current : defaultAnimalForLevel(next));
  };

  return (
    <main className="solo-camp">
      <header className="solo-camp__header"><button type="button" onClick={onBack}>Back</button><div><small>Private expedition</small><h1>Solo field plan</h1></div><span>Practice range</span></header>
      <div className="solo-camp__grid">
        <section className="solo-card solo-card--role">
          <Heading step="01" title="Choose your role" />
          <div className="solo-role-grid">
            {ROLES.map((item) => <button type="button" key={item.value} className={role === item.value ? "is-picked" : ""} onClick={() => setRole(item.value)} aria-pressed={role === item.value}><b aria-hidden="true">{item.mark}</b><strong>{item.label}</strong><span>{item.detail}</span></button>)}
          </div>
        </section>

        <section className="solo-card solo-card--map">
          <Heading step="02" title="Choose a challenge district" />
          <div className="solo-map-grid">
            {LEVEL_ORDER.map((id) => <button type="button" key={id} className={level === id ? "is-picked" : ""} onClick={() => selectLevel(id)} aria-pressed={level === id}><i className={`solo-biome solo-biome--${id}`} /><strong>{LEVELS[id].displayName}</strong><span>{LEVELS[id].subtitle}</span></button>)}
          </div>
        </section>

        <section className="solo-card solo-card--loadout">
          <Heading step="03" title="Pack your field kit" />
          <label>Animal disguise<select aria-label="Animal disguise" value={animal} onChange={(event) => setAnimal(event.target.value as AnimalType)}>{animalsForLevel(level).map((id) => <option key={id} value={id}>{ANIMAL_DEFS[id].label}</option>)}</select></label>
          <label>Perk<select aria-label="Solo perk" value={perk} onChange={(event) => setPerk(event.target.value as PerkType)}>{PERK_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="solo-loadout-note"><strong>{PERK_OPTIONS.find((item) => item.value === perk)?.label}</strong><span>{PERK_OPTIONS.find((item) => item.value === perk)?.description}</span></div>
        </section>

        <section className="solo-card solo-card--rules">
          <Heading step="04" title="Set the challenge" />
          <fieldset><legend>Difficulty</legend><div className="solo-segmented">{(["easy", "normal", "hard"] as SoloDifficulty[]).map((item) => <button key={item} type="button" className={difficulty === item ? "is-picked" : ""} onClick={() => setDifficulty(item)} aria-pressed={difficulty === item}>{DIFFICULTIES[item].label}</button>)}</div><p className="solo-difficulty-copy">{DIFFICULTIES[difficulty].detail}</p></fieldset>
          <label>Bots <strong>{botCount}</strong><input aria-label="Bot count" type="range" min={2} max={12} value={botCount} onChange={(event) => setBotCount(Number(event.target.value))} /></label>
          <label>Round length<select aria-label="Solo round length" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option></select></label>
        </section>
      </div>
      <footer className="solo-camp__footer"><div><small>Field plan</small><strong>{ROLES.find((item) => item.value === role)?.label} · {LEVELS[level].displayName} · {DIFFICULTIES[difficulty].label}</strong></div><button type="button" onClick={() => onStart({ role, botCount, level, animal, perk, duration, difficulty })}><span>Start solo expedition</span><small>Launch with {botCount} AI players</small></button></footer>
    </main>
  );
}

function Heading({ step, title }: { step: string; title: string }) { return <div className="solo-heading"><span>{step}</span><div><small>Field plan</small><h2>{title}</h2></div></div>; }
