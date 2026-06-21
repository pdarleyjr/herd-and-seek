import { useState } from "react";

const RULES = [
  { icon: "🐾", color: "#7fff00", title: "You Are an Animal — Blend In & Survive",
    text: "Mix into the NPC herd. Copy their movement speed and direction. If you stand still while everyone moves, the hunter will spot you. Survive the full timer and animals win!" },
  { icon: "🎯", color: "#ff6b6b", title: "You Are the Hunter — Aim & Tag",
    text: "You have limited ammo. Find the REAL players hiding among hundreds of NPC animals. Aim your crosshair, then press FIRE. Run out of ammo and animals win." },
  { icon: "🦓", color: "#f5d07a", title: "Choose Your Morph",
    text: "Before each match, pick an animal disguise. Pick one that's common in the NPC herd — if elephants are everywhere, be an elephant!" },
  { icon: "⚡", color: "#c8a05a", title: "Upgrades & Perks",
    text: "Sprint — short speed burst.\nCamouflage — freeze perfectly for 3 seconds.\nExtra Life — survive your first hit.\nDecoy — drop a fake copy of yourself.\nSpeed Boost — permanently faster." },
  { icon: "🌿", color: "#4ade80", title: "Hiding Spots",
    text: "Walk into tall grass patches to get a HIDDEN bonus (shown above your character). While hidden, you are harder to spot. Tip: move slowly or stop while hidden." },
  { icon: "📡", color: "#ff8844", title: "Hunter Radar",
    text: "The Hunter's minimap has a radar cycle:\n• RADAR ACTIVE (5s) — all animal positions shown as red dots.\n• SCANNING (5s) — positions go dark.\nAnimals: freeze when the minimap border turns orange!" },
  { icon: "📱", color: "#88aaff", title: "Mobile Controls",
    text: "Animals: drag the left side to move · tap your perk button to activate upgrade.\nHunter: drag left side to move · drag RIGHT side to aim the crosshair · tap the large red FIRE button to shoot." },
  { icon: "🎮", color: "#f5d07a", title: "Solo Practice",
    text: "Tap 'Play Solo vs AI' to practice alone. The game randomly makes you Hunter or Animal against AI bots. Great for learning before playing with others!" },
];

/** Floating button + full-screen modal overlay */
export default function HowToPlayModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="flex items-center gap-2 select-none"
        style={{
          background: "rgba(40,20,5,0.85)",
          border: "2px solid #8b5c1e",
          borderRadius: 12,
          padding: "8px 14px",
          color: "#f5d07a",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.05em",
          touchAction: "manipulation",
          cursor: "pointer",
        }}
        aria-label="How to Play"
      >
        <span style={{ fontSize: 18 }}>📖</span>
        <span>How to Play</span>
      </button>

{/* Full-screen modal */}
       {open && (
         <div
           className="fixed inset-0 z-[9999] flex flex-col"
           style={{ background: "rgba(0,0,0,0.92)", touchAction: "none" }}
         >
           {/* Header */}
           <div
             className="flex items-center justify-between shrink-0"
             style={{
               padding: "max(16px, env(safe-area-inset-top, 16px)) 20px 16px",
               background: "rgba(40,20,5,0.95)",
               borderBottom: "2px solid #5a3010",
               width: "100%",
             }}
           >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 26 }}>📖</span>
              <span
                style={{
                  color: "#f5d07a",
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                How to Play
              </span>
            </div>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              style={{
                background: "rgba(140,60,10,0.7)",
                border: "2px solid #a06020",
                borderRadius: 10,
                padding: "8px 16px",
                color: "#f5d07a",
                fontWeight: 800,
                fontSize: 16,
                touchAction: "manipulation",
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕ Close
            </button>
          </div>

{/* Scrollable rules */}
           <div
             className="flex-1 overflow-y-auto"
             style={{
               overscrollBehavior: "contain",
               WebkitOverflowScrolling: "touch",
               padding: "12px 0",
               maxWidth: "800px",
               margin: "0 auto",
             } as React.CSSProperties}
           >
             <div style={{ maxWidth: "560px", margin: "0 auto", width: "100%" }}>
             {RULES.map((rule, i) => (
               <div
                 key={rule.title}
                 style={{
                   display: "flex",
                   gap: 16,
                   alignItems: "flex-start",
                   padding: "16px 20px",
                   borderBottom: i < RULES.length - 1 ? "1px solid rgba(90,48,16,0.4)" : "none",
                 }}
               >
                 {/* Icon */}
                 <span
                   style={{
                     fontSize: 36,
                     lineHeight: 1,
                     flexShrink: 0,
                     marginTop: 2,
                     width: 44,
                     textAlign: "center",
                   }}
                 >
                   {rule.icon}
                 </span>

                 {/* Text */}
                 <div style={{ flex: 1 }}>
                   <div
                     style={{
                       color: rule.color,
                       fontWeight: 800,
                       fontSize: 16,
                       marginBottom: 6,
                       lineHeight: 1.3,
                     }}
                   >
                     {rule.title}
                   </div>
                   <div
                     style={{
                       color: "#d4a870",
                       fontSize: 14,
                       lineHeight: 1.65,
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
                 padding: "16px 20px",
                 color: "#6b4a2a",
                 fontSize: 12,
                 textAlign: "center",
                 paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
               }}
             >
               Tip: Watch the NPC animals to learn what &ldquo;blending in&rdquo; looks like before the match starts.
             </div>
             </div>
           </div>
         </div>
       )}
    </>
  );
}
