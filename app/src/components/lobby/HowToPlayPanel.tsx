import { useState } from "react";

const RULES = [
  {
    icon: "🐾",
    title: "You Are an Animal — Hide & Survive",
    text: "Blend in with the NPC herd by moving like them. Stand still near other animals. Survive until the timer ends and your team wins!",
    color: "#7fff00",
  },
  {
    icon: "🎯",
    title: "You Are the Hunter — Find & Tag",
    text: "One player is the Hunter. Locate the real players hiding among the NPCs. Aim and click or tap the FIRE button to shoot them. Don't waste all your ammo on misses!",
    color: "#ff6b6b",
  },
  {
    icon: "🦓",
    title: "Choose Your Morph",
    text: "Before the match, pick your animal disguise from the Morphs panel. Pick a type that's common in the NPC herd — elephant, monkey, giraffe work well.",
    color: "#f5d07a",
  },
  {
    icon: "⚡",
    title: "Pick an Upgrade",
    text: "Sprint (speed burst) · Camouflage (freeze & go invisible) · Extra Life (survive one hit) · Decoy (drop a fake copy) · Speed Boost (always faster). Tap your perk button in-game to activate!",
    color: "#c8a05a",
  },
  {
    icon: "🌿",
    title: "Use Hiding Spots",
    text: "Walk into tall grass patches for a HIDDEN bonus. Hidden animals are harder to spot. Tip: stop moving while hidden — moving reduces the cover effect.",
    color: "#4ade80",
  },
  {
    icon: "📍",
    title: "Hunter Radar",
    text: "The Hunter's minimap pulses every 5 seconds showing all animal positions (RADAR ACTIVE). During the 5-second scan gap, all positions go dark. Animals — freeze when radar activates!",
    color: "#ff8844",
  },
  {
    icon: "📱",
    title: "Mobile Controls",
    text: "Animals: drag left side to move, tap perk button to use upgrade.\nHunter: drag left to move · drag right side to aim crosshair · click or tap the big FIRE button to shoot.",
    color: "#88aaff",
  },
  {
    icon: "🎮",
    title: "Play Solo",
    text: "No friends online? Tap 'Play Solo vs AI' to practice! The game randomly assigns you as Hunter or Animal against AI bots. Great for learning controls.",
    color: "#f5d07a",
  },
];

interface HowToPlayPanelProps {
  collapsed?: boolean;
}

export default function HowToPlayPanel({ collapsed = false }: HowToPlayPanelProps) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div
      className="w-full rounded-2xl border-2 border-[#5a3010] overflow-hidden"
      style={{ background: "rgba(12,6,2,0.92)" }}
    >
      {/* Toggle header */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between select-none"
        style={{
          padding: "14px 18px",
          touchAction: "manipulation",
          minHeight: 52,
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>📖</span>
          <span
            style={{
              color: "#f5d07a",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            How to Play
          </span>
        </div>
        <span
          style={{
            color: "#c8a05a",
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 700,
          }}
        >
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Content — each rule as a clear card */}
      {open && (
        <div
          style={{
            borderTop: "1px solid #3d1808",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {RULES.map((rule, i) => (
            <div
              key={rule.title}
              style={{
                padding: "14px 18px",
                borderTop: i === 0 ? "none" : "1px solid rgba(90,48,16,0.5)",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              {/* Icon */}
              <span
                style={{
                  fontSize: 28,
                  lineHeight: 1,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {rule.icon}
              </span>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: rule.color,
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 5,
                    lineHeight: 1.3,
                  }}
                >
                  {rule.title}
                </div>
                <div
                  style={{
                    color: "#c8a05a",
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-line",
                  }}
                >
                  {rule.text}
                </div>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div
            style={{
              padding: "10px 18px",
              borderTop: "1px solid rgba(90,48,16,0.5)",
              color: "#6b4a2a",
              fontSize: 11,
              textAlign: "center",
            }}
          >
            Need help? Watch the NPC animals to learn what &quot;blending in&quot; looks like.
          </div>
        </div>
      )}
    </div>
  );
}
