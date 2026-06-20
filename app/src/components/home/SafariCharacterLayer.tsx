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

// ── Hunter SVG: crouching behind rocks, head + rifle peeking over cover ──
// This pose reads clearly at any size: hat silhouette above the rocks, barrel pointing right.
function HunterSvg() {
  return (
    <svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="115" cy="193" rx="100" ry="8" fill="rgba(0,0,0,0.22)" />

      {/* Grass tufts — in front of and around rocks */}
      <path d="M8  192 Q14 155 20 192" stroke="#2e8a18" strokeWidth="7"  fill="none" strokeLinecap="round"/>
      <path d="M22 192 Q30 148 38 192" stroke="#3aaa20" strokeWidth="8"  fill="none" strokeLinecap="round"/>
      <path d="M44 192 Q50 160 56 192" stroke="#248010" strokeWidth="6"  fill="none" strokeLinecap="round"/>
      <path d="M62 192 Q68 158 73 192" stroke="#3aaa20" strokeWidth="6"  fill="none" strokeLinecap="round"/>
      <path d="M90 192 Q95 162 100 192" stroke="#2e8a18" strokeWidth="5" fill="none" strokeLinecap="round"/>

      {/* Rock mound — hunter crouches behind this wall */}
      <ellipse cx="78"  cy="172" rx="72" ry="34" fill="#7a6e58" />
      <ellipse cx="72"  cy="163" rx="65" ry="27" fill="#928470" />
      <ellipse cx="80"  cy="158" rx="58" ry="22" fill="#b0a07c" />
      {/* Lighter crest on top of rocks */}
      <ellipse cx="78"  cy="152" rx="50" ry="10" fill="#c0b090" opacity="0.6"/>

      {/* Hunter body — hidden behind rocks, only shoulders visible */}
      <path
        d="M42 158 Q68 140 105 138 Q118 137 125 142 Q118 152 105 154 Q70 158 48 165 Z"
        fill="#8b7850"
      />

      {/* Left arm resting on top of rock, holding rifle forward */}
      <path d="M98 145 Q128 136 162 136" stroke="#8b7850" strokeWidth="15" fill="none" strokeLinecap="round"/>
      {/* Left hand gripping rifle */}
      <circle cx="162" cy="136" r="10" fill="#c8956b"/>

      {/* Second hand near barrel */}
      <circle cx="128" cy="140" r="9"  fill="#b88050"/>

      {/* Rifle: stock + body + long barrel pointing right */}
      <rect x="128" y="128" width="40" height="13" rx="5"  fill="#5c3c18"/>
      <rect x="164" y="127" width="78" height="9"  rx="3.5" fill="#2a2a2a"/>
      {/* Scope */}
      <rect x="172" y="121" width="24" height="10" rx="3"  fill="#1a1a1a"/>
      <rect x="181" y="118" width="8"  height="6"  rx="2"  fill="#333"/>
      {/* Muzzle flash guard tip */}
      <rect x="238" y="128" width="4"  height="7"  rx="1"  fill="#1a1a1a"/>

      {/* Neck connecting shoulder to head */}
      <rect x="100" y="120" width="18" height="22" rx="9" fill="#c8956b"/>

      {/* Head — clear side profile, facing right */}
      <circle cx="114" cy="106" r="26" fill="#d4956a"/>
      {/* Face shading (jaw/cheek shadow) */}
      <path d="M102 112 Q114 120 128 114" fill="#c08050" opacity="0.4"/>
      {/* Ear */}
      <ellipse cx="94" cy="108" rx="7" ry="9" fill="#c48860"/>

      {/* Safari hat — distinctive large brim is key at small sizes */}
      {/* Brim — wide flat ellipse */}
      <ellipse cx="116" cy="86"  rx="36" ry="11" fill="#7a5818"/>
      {/* Crown */}
      <path d="M88 86 Q90 58 115 53 Q140 58 142 86 Z" fill="#96721e"/>
      {/* Hat band */}
      <rect x="88" y="82" width="54" height="7" rx="3" fill="#5a3c0a"/>
      {/* Subtle highlight on crown */}
      <ellipse cx="110" cy="66" rx="12" ry="5" fill="rgba(255,210,100,0.22)" />

      {/* Eye — single dot in profile, gives life to the face */}
      <circle cx="130" cy="108" r="4.5" fill="#fffde0"/>
      <circle cx="131" cy="108" r="3"   fill="#1a1008"/>
      <circle cx="132" cy="107" r="1.2" fill="white"/>

      {/* Nose profile */}
      <path d="M136 112 Q140 118 137 122" stroke="#b07050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

      {/* Focused mouth */}
      <path d="M126 120 Q134 124 138 121" stroke="#8a5030" strokeWidth="2" fill="none" strokeLinecap="round"/>
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
