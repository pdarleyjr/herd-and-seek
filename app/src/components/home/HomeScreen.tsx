import { useState } from "react";
import HomeBackground from "./HomeBackground";
import HerdSeekTitle from "./HerdSeekTitle";
import SafariCharacterLayer from "./SafariCharacterLayer";
import NameEntryCard from "./NameEntryCard";

interface HomeScreenProps {
  nameInput: string;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
}

export default function HomeScreen({ nameInput, onNameChange, onSubmit }: HomeScreenProps) {
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const name = nameInput.trim();
    if (!name) {
      setError("Enter a name to play.");
      return;
    }
    if (name.length < 1 || name.length > 24) {
      setError("Name must be 1–24 characters.");
      return;
    }
    setError("");
    onSubmit();
  };

  const handleChange = (v: string) => {
    onNameChange(v);
    if (error) setError("");
  };

  return (
    <section
      className="home-animated relative isolate w-dvw min-h-dvh overflow-hidden"
      style={{ userSelect: "none" }}
    >
      {/* Layered background: sky, sun, clouds, savanna, ground */}
      <HomeBackground />

      {/* Safari characters: hunter left, tree right, lion right */}
      <SafariCharacterLayer />

      {/* ── Foreground vignette for depth ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 60%, transparent 40%, rgba(0,0,0,0.18) 100%)",
        }}
        aria-hidden="true"
      />

      {/* ── UI content: title + name entry ── */}
      <main
        className="relative z-20 flex min-h-dvh flex-col items-center justify-start px-4 pt-[8dvh] pb-[20dvh]"
        style={{ gap: "clamp(14px, 3dvh, 32px)" }}
      >
        {/* Game title */}
        <HerdSeekTitle />

        {/* Tagline */}
        <p
          className="text-center font-semibold"
          style={{
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            fontSize: "clamp(12px, 1.8vw, 17px)",
            letterSpacing: "0.05em",
          }}
        >
          Blend in with the herd · Or hunt them down
        </p>

        {/* Name entry */}
        <NameEntryCard
          value={nameInput}
          onChange={handleChange}
          onSubmit={handleSubmit}
          error={error}
        />
      </main>

      {/* Bottom foreground leaf overlay (decorative) */}
      <ForegroundLeaves />
    </section>
  );
}

// Small foreground leaf clusters at the bottom corners for depth
function ForegroundLeaves() {
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10" aria-hidden="true">
      {/* Bottom-left leaves */}
      <div className="absolute bottom-0 left-0" style={{ width: "18%", minWidth: 80 }}>
        <svg viewBox="0 0 160 120" className="w-full h-auto">
          <ellipse cx="30"  cy="120" rx="24" ry="50" fill="#1a6010" transform="rotate(-20 30 120)"/>
          <ellipse cx="60"  cy="120" rx="20" ry="45" fill="#2a7818" transform="rotate(-5 60 120)"/>
          <ellipse cx="85"  cy="120" rx="18" ry="40" fill="#3a9020" transform="rotate(10 85 120)"/>
          <ellipse cx="50"  cy="120" rx="16" ry="38" fill="#248014" transform="rotate(-12 50 120)" opacity="0.8"/>
          <ellipse cx="25"  cy="112" rx="12" ry="28" fill="#3aa020" transform="rotate(-25 25 112)"/>
        </svg>
      </div>
      {/* Bottom-right leaves */}
      <div className="absolute bottom-0 right-0" style={{ width: "14%", minWidth: 60 }}>
        <svg viewBox="0 0 130 100" className="w-full h-auto">
          <ellipse cx="100" cy="100" rx="22" ry="44" fill="#1a6010" transform="rotate(18 100 100)"/>
          <ellipse cx="72"  cy="100" rx="18" ry="38" fill="#2a7818" transform="rotate(5 72 100)"/>
          <ellipse cx="50"  cy="100" rx="16" ry="34" fill="#3a9020" transform="rotate(-8 50 100)"/>
        </svg>
      </div>
    </div>
  );
}
