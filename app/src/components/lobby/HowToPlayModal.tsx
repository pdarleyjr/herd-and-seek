import { useState } from "react";
import { useViewportInfo } from "../../hooks/useViewportInfo";

const RULES = [
  { icon: "🗺️", color: "#39c0e6", title: "Choose Your Level",
    text: "In the lobby, pick a map:\n• Forest — classic hide-and-seek in trees, grass, rocks, and shadows. Forest morphs only.\n• The Deep Dark — an ocean map with kelp, barrels, boats, and currents. Ocean morphs only.\nThe morph panel instantly shows only the animals allowed on the selected level." },
  { icon: "🌳", color: "#7fff00", title: "Forest — Blend In & Survive",
    text: "Mix into the NPC herd of forest animals. Copy their movement. Walk into tall grass and bushes for a 🌿 HIDDEN bonus. Rocks and trees break the hunter's line of sight. Survive the timer and the animals win!" },
  { icon: "🌊", color: "#39c0e6", title: "The Deep Dark — Ocean Hide & Seek",
    text: "You're a sea creature among a moving shoal. Hide in kelp 🌿 and seaweed for a 🪸 CONCEALED bonus. Boats, barrels, and reefs are landmarks and cover. Current lanes drift across the map. The hunter is a SCUBA DIVER using sonar and careful shots." },
  { icon: "🎯", color: "#ff6b6b", title: "You Are the Hunter — Aim & Tag",
    text: "You have limited ammo. Find the REAL players hiding among hundreds of NPC animals. Aim your crosshair, then click or tap FIRE. On touchscreens, a quick double tap on the right side also fires. Run out of ammo and animals win." },
  { icon: "🦓", color: "#f5d07a", title: "Choose Your Morph",
    text: "Before each match, pick a disguise that matches the level's wildlife. Pick one that's common in the NPC herd — if fish are everywhere, be a fish!" },
  { icon: "⚡", color: "#c8a05a", title: "Upgrades & Perks",
    text: "Sprint — short speed burst.\nCamouflage — freeze perfectly for 3 seconds.\nExtra Life — survive your first hit.\nDecoy — drop a fake copy of yourself.\nSpeed Boost — permanently faster." },
  { icon: "📡", color: "#ff8844", title: "Hunter Radar / Sonar",
    text: "The Hunter's minimap has a radar cycle:\n• RADAR ACTIVE (5s) — animal positions shown as red dots.\n• SCANNING (5s) — positions go dark.\nAnimals: freeze when the minimap border turns orange!\nOcean hunters: sonar pings give approximate zones, not exact positions." },
  { icon: "📱", color: "#88aaff", title: "Mobile & Tablet Controls",
    text: "Animals: drag the LEFT side to move, tap your perk button to activate.\nHunter:\n• Left thumb → move.\n• Right thumb → AIM the crosshair. Dragging aims; it NEVER fires.\n• Quick double tap on the right side → shoot.\n• Large red FIRE button (bottom-right) → click or tap to shoot.\n• Aim assist softly nudges shots toward the nearest animal on phones/tablets.\n• The FIRE button is safe-area aware so it's never under the home indicator. The screen will not scroll or zoom." },
  { icon: "🎮", color: "#f5d07a", title: "Solo Practice",
    text: "Tap 'Play Solo vs AI' to practice alone. The game randomly makes you Hunter or Animal against AI bots. Bots use the selected level's morphs and behavior. Great for learning before playing with others!" },
];

/** Floating button + full-screen modal overlay */
export default function HowToPlayModal() {
  const [open, setOpen] = useState(false);
  const { isCompact } = useViewportInfo();

  return (
    <>
      {/* Trigger button */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
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
               padding: `${isCompact ? 12 : 16}px  ${isCompact ? 14 : 20}px ${isCompact ? 12 : 16}px`,
               background: "rgba(40,20,5,0.95)",
               borderBottom: "2px solid #5a3010",
               width: "100%",
             }}
           >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: isCompact ? 22 : 26 }}>📖</span>
              <span
                style={{
                  color: "#f5d07a",
                  fontWeight: 800,
                  fontSize: isCompact ? 18 : 20,
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
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(140,60,10,0.7)",
                border: "2px solid #a06020",
                borderRadius: 10,
                padding: isCompact ? "7px 14px" : "8px 16px",
                color: "#f5d07a",
                fontWeight: 800,
                fontSize: isCompact ? 14 : 16,
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
               padding: isCompact ? "8px 0" : "12px 0",
               maxWidth: "min(100%, 800px)",
               margin: "0 auto",
             } as React.CSSProperties}
           >
             <div style={{ maxWidth: isCompact ? "520px" : "560px", margin: "0 auto", width: "100%" }}>
             {RULES.map((rule, i) => (
               <div
                 key={rule.title}
                 style={{
                   display: "flex",
                   gap: isCompact ? 12 : 16,
                   alignItems: "flex-start",
                   padding: isCompact ? "12px 16px" : "16px 20px",
                   borderBottom: i < RULES.length - 1 ? "1px solid rgba(90,48,16,0.4)" : "none",
                 }}
               >
                 {/* Icon */}
                 <span
                   style={{
                     fontSize: isCompact ? 30 : 36,
                     lineHeight: 1,
                     flexShrink: 0,
                     marginTop: 2,
                     width: isCompact ? 40 : 44,
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
                       fontSize: isCompact ? 15 : 16,
                       marginBottom: 6,
                       lineHeight: 1.3,
                     }}
                   >
                     {rule.title}
                   </div>
                   <div
                     style={{
                       color: "#d4a870",
                       fontSize: isCompact ? 13 : 14,
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
                 padding: isCompact ? "12px 16px" : "16px 20px",
                 color: "#6b4a2a",
                 fontSize: isCompact ? 11 : 12,
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
