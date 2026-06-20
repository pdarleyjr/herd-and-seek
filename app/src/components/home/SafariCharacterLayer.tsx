import SvgTree from "../lobby/SvgTree";

// Safari character layer: hunter (left) + tree (right) + lion (right foreground)
// All absolute-positioned over the background
export default function SafariCharacterLayer() {
  return (
    <div className="home-animated absolute inset-0 pointer-events-none" aria-hidden="true">

      {/* ── Large acacia tree — right side ── */}
      <div
        className="absolute"
        style={{
          right: "2%",
          bottom: "10%",
          width: "clamp(180px, 26vw, 380px)",
          filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.35))",
          animation: "leafBob 6s ease-in-out infinite",
        }}
      >
        <SvgTree className="w-full h-auto" />
      </div>

      {/* ── Hunter — bottom-left, crouched behind rock ── */}
      <div
        className="absolute"
        style={{
          left: "2%",
          bottom: "8%",
          width: "clamp(160px, 22vw, 320px)",
          animation: "hunterBreathe 4s ease-in-out infinite",
          filter: "drop-shadow(2px 6px 8px rgba(0,0,0,0.4))",
        }}
      >
        <HunterSvg />
      </div>

      {/* ── Lion — bottom-right foreground, near tree base ── */}
      <div
        className="absolute"
        style={{
          right: "18%",
          bottom: "9%",
          width: "clamp(120px, 16vw, 230px)",
          filter: "drop-shadow(2px 5px 8px rgba(0,0,0,0.4))",
        }}
      >
        <LionSvg />
      </div>
    </div>
  );
}

// ── Hunter SVG: crouched prone, facing right, safari hat, rifle ──
function HunterSvg() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="140" cy="172" rx="110" ry="10" fill="rgba(0,0,0,0.25)" />

      {/* Rocks for cover */}
      <ellipse cx="60"  cy="155" rx="52" ry="28" fill="#7a6e58" />
      <ellipse cx="55"  cy="148" rx="46" ry="22" fill="#928470" />
      <ellipse cx="65"  cy="145" rx="38" ry="18" fill="#a8967c" />
      <ellipse cx="38"  cy="158" rx="32" ry="16" fill="#7a6e58" />

      {/* Tall grass tufts around the rock */}
      <path d="M15 162 Q20 128 26 162"  stroke="#2e8a18" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <path d="M28 162 Q36 120 42 162"  stroke="#3aaa20" strokeWidth="8" fill="none" strokeLinecap="round"/>
      <path d="M8  162 Q14 138 18 162"  stroke="#248010" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M44 162 Q52 118 58 162"  stroke="#3aaa20" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <path d="M80 162 Q86 132 90 162"  stroke="#2e8a18" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M100 162 Q104 140 107 162" stroke="#3aaa20" strokeWidth="5" fill="none" strokeLinecap="round"/>

      {/* Body — torso lying prone, angled up slightly to right */}
      <path d="M55 148 Q100 130 175 128 Q185 128 190 134 Q185 144 170 146 Q120 148 70 158 Q58 160 52 155 Z" fill="#8b7850" />
      {/* Body shading */}
      <path d="M60 135 Q110 122 170 122" stroke="#6a5a38" strokeWidth="4" fill="none" opacity="0.4"/>

      {/* Legs (below body, khaki) */}
      <path d="M55 153 Q40 165 30 168" stroke="#7a6a40" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <path d="M70 155 Q60 168 50 172" stroke="#8a7a50" strokeWidth="12" fill="none" strokeLinecap="round"/>
      {/* Boots */}
      <ellipse cx="30" cy="168" rx="14" ry="7" fill="#4a3820" />
      <ellipse cx="50" cy="172" rx="12" ry="6" fill="#4a3820" />

      {/* Left arm extending forward with rifle */}
      <path d="M170 132 Q210 118 240 112" stroke="#8b7850" strokeWidth="11" fill="none" strokeLinecap="round"/>
      {/* Rifle stock */}
      <rect x="175" y="118" width="55" height="10" rx="4" fill="#5c3c18" transform="rotate(-8 175 118)"/>
      {/* Rifle barrel — extends right */}
      <rect x="225" y="110" width="52" height="6" rx="3" fill="#2a2a2a" transform="rotate(-8 225 110)"/>
      {/* Scope */}
      <rect x="228" y="105" width="22" height="9" rx="3" fill="#1a1a1a" transform="rotate(-8 228 105)"/>
      <rect x="237" y="102" width="6" height="5" rx="2" fill="#333" transform="rotate(-8 237 102)"/>
      {/* Muzzle tip */}
      <circle cx="274" cy="108" r="4" fill="#1a1a1a" transform="rotate(-8 274 108)"/>

      {/* Right arm propped on rock */}
      <path d="M155 138 Q145 148 138 152" stroke="#8b7850" strokeWidth="11" fill="none" strokeLinecap="round"/>
      {/* Hand/glove */}
      <circle cx="135" cy="153" r="9" fill="#7a6a50" />

      {/* Head */}
      <circle cx="186" cy="116" r="22" fill="#d4956a" />
      {/* Shadow on face */}
      <path d="M172 110 Q186 105 200 112" fill="#c08050" />
      {/* Ear */}
      <ellipse cx="166" cy="118" rx="6" ry="8" fill="#c88050" />

      {/* Safari hat — brim */}
      <ellipse cx="188" cy="100" rx="30" ry="9" fill="#7a5818" />
      {/* Hat crown */}
      <path d="M164 100 Q168 74 188 70 Q208 74 212 100 Z" fill="#96721e" />
      {/* Hat band */}
      <rect x="164" y="97" width="48" height="6" rx="3" fill="#5a3c0a" />
      {/* Hat shine */}
      <ellipse cx="182" cy="80" rx="10" ry="5" fill="rgba(255,220,120,0.2)" transform="rotate(-10 182 80)"/>

      {/* Eye (visible) */}
      <ellipse cx="196" cy="118" rx="5" ry="4" fill="#fffde0"/>
      <circle cx="197" cy="118" r="3" fill="#2a1808"/>
      <circle cx="198" cy="117" r="1" fill="white"/>

      {/* Nose */}
      <ellipse cx="202" cy="124" rx="4" ry="3" fill="#b87050"/>
      {/* Mouth — focused grimace */}
      <path d="M193 128 Q200 131 205 128" stroke="#8a5030" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Lion SVG: standing/prowling, facing left toward hunter ──
function LionSvg() {
  return (
    <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="100" cy="173" rx="75" ry="9" fill="rgba(0,0,0,0.25)" />

      {/* Tail (behind body) */}
      <path
        d="M170 120 Q192 95 195 108 Q196 118 188 122"
        stroke="#c8882a"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        style={{ transformOrigin: "170px 120px", animation: "lionTail 2.8s ease-in-out infinite" }}
      />
      {/* Tail tuft */}
      <ellipse cx="190" cy="112" rx="11" ry="10" fill="#8b5c18" />

      {/* Body */}
      <ellipse cx="108" cy="140" rx="70" ry="38" fill="#e8a030" />
      {/* Body shading */}
      <ellipse cx="108" cy="148" rx="60" ry="26" fill="#d09028" opacity="0.5"/>
      {/* Body highlight */}
      <ellipse cx="95" cy="128" rx="40" ry="18" fill="#f0b840" opacity="0.4"/>

      {/* Mane — dark outer ring */}
      <circle cx="90" cy="98" r="46" fill="#a06820" />
      {/* Mane — inner ring */}
      <circle cx="90" cy="98" r="38" fill="#c08030" />
      {/* Face */}
      <circle cx="90" cy="95" r="30" fill="#e8a030" />

      {/* Ears */}
      <path d="M65 68 Q58 50 74 62" fill="#e8a030" stroke="#c08030" strokeWidth="2.5"/>
      <ellipse cx="67" cy="60" rx="6" ry="5" fill="#e8b060" opacity="0.6"/>
      <path d="M115 68 Q122 50 106 62" fill="#e8a030" stroke="#c08030" strokeWidth="2.5"/>
      <ellipse cx="113" cy="60" rx="6" ry="5" fill="#e8b060" opacity="0.6"/>

      {/* Forehead */}
      <ellipse cx="88" cy="82" rx="20" ry="12" fill="#f0b840" opacity="0.4"/>

      {/* Eyes — amber, alert */}
      <ellipse cx="76" cy="93" rx="9" ry="8" fill="#f5cc50"/>
      <ellipse cx="104" cy="93" rx="9" ry="8" fill="#f5cc50"/>
      <circle  cx="77" cy="94" r="5"   fill="#1a1008"/>
      <circle  cx="105" cy="94" r="5"   fill="#1a1008"/>
      {/* Pupils — vertical slit */}
      <ellipse cx="77" cy="94" rx="2.5" ry="4.5" fill="#050300"/>
      <ellipse cx="105" cy="94" rx="2.5" ry="4.5" fill="#050300"/>
      {/* Eye shine */}
      <circle cx="79" cy="91" r="2"   fill="white" opacity="0.9"/>
      <circle cx="107" cy="91" r="2"   fill="white" opacity="0.9"/>

      {/* Nose */}
      <path d="M80 106 Q90 113 100 106 Q90 118 80 106 Z" fill="#c04828"/>
      <ellipse cx="82" cy="107" rx="4" ry="3" fill="#d05030" opacity="0.6"/>

      {/* Mouth */}
      <path d="M80 116 Q90 122 100 116" stroke="#a03820" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M90 116 L90 120" stroke="#a03820" strokeWidth="2" fill="none" strokeLinecap="round"/>

      {/* Whisker dots */}
      <circle cx="67" cy="112" r="2.5" fill="#b07830" opacity="0.7"/>
      <circle cx="61" cy="107" r="2"   fill="#b07830" opacity="0.6"/>
      <circle cx="113" cy="112" r="2.5" fill="#b07830" opacity="0.7"/>
      <circle cx="119" cy="107" r="2"   fill="#b07830" opacity="0.6"/>

      {/* Front legs */}
      <rect x="52"  y="155" width="22" height="26" rx="11" fill="#d09028"/>
      <rect x="82"  y="158" width="22" height="24" rx="11" fill="#d09028"/>
      {/* Back legs (partially behind body) */}
      <rect x="118" y="152" width="22" height="26" rx="11" fill="#c88020"/>
      <rect x="146" y="150" width="20" height="28" rx="10" fill="#c88020"/>

      {/* Paws */}
      <ellipse cx="62"  cy="178" rx="14" ry="7"  fill="#b87820"/>
      <ellipse cx="92"  cy="179" rx="13" ry="6.5" fill="#b87820"/>
      <ellipse cx="128" cy="175" rx="13" ry="7"  fill="#a86818"/>
      <ellipse cx="155" cy="174" rx="12" ry="7"  fill="#a86818"/>

      {/* Claw marks on front paws */}
      <path d="M56 180 Q54 185 53 188" stroke="#8a5c10" strokeWidth="1.5" fill="none"/>
      <path d="M62 181 Q62 186 61 189" stroke="#8a5c10" strokeWidth="1.5" fill="none"/>
      <path d="M68 180 Q70 185 71 188" stroke="#8a5c10" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}
