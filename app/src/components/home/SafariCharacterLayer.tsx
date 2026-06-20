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

// ── Hunter SVG: standing in front of rock, full figure visible, facing right ──
// Draw order: ground → rock (background) → grass → hunter body (foreground)
function HunterSvg() {
  return (
    <svg viewBox="0 0 280 240" xmlns="http://www.w3.org/2000/svg">

      {/* ── Ground shadow ── */}
      <ellipse cx="130" cy="232" rx="110" ry="9" fill="rgba(0,0,0,0.22)" />

      {/* ── Rock formation — drawn FIRST so hunter paints over it ── */}
      <ellipse cx="48"  cy="210" rx="46" ry="28" fill="#6e6450" />
      <ellipse cx="44"  cy="200" rx="40" ry="22" fill="#887a60" />
      <ellipse cx="52"  cy="194" rx="34" ry="18" fill="#a89870" />
      {/* Rock highlight */}
      <ellipse cx="50"  cy="188" rx="26" ry="9"  fill="#c0b080" opacity="0.55"/>
      {/* A second smaller rock to the right rear */}
      <ellipse cx="198" cy="215" rx="32" ry="20" fill="#6e6450" />
      <ellipse cx="202" cy="207" rx="26" ry="16" fill="#a89870" />

      {/* ── Grass tufts — on top of rocks and ground ── */}
      <path d="M6  228 Q12 190 18 228" stroke="#2e8a18" strokeWidth="6"  fill="none" strokeLinecap="round"/>
      <path d="M20 228 Q28 184 36 228" stroke="#3aaa20" strokeWidth="7"  fill="none" strokeLinecap="round"/>
      <path d="M42 228 Q48 198 54 228" stroke="#248010" strokeWidth="5"  fill="none" strokeLinecap="round"/>
      <path d="M210 228 Q216 200 222 228" stroke="#3aaa20" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M228 228 Q232 202 237 228" stroke="#2e8a18" strokeWidth="5" fill="none" strokeLinecap="round"/>

      {/* ══════════════════════════════════════════════
          HUNTER — drawn last so he's fully in front
          Standing side profile, facing right
          ══════════════════════════════════════════════ */}

      {/* Rear boot */}
      <ellipse cx="108" cy="226" rx="17" ry="8" fill="#3e3018" />
      {/* Rear lower leg */}
      <rect x="100" y="180" width="16" height="48" rx="8" fill="#6e5e38" />

      {/* Front boot */}
      <ellipse cx="132" cy="226" rx="19" ry="8" fill="#3e3018" />
      {/* Front lower leg */}
      <rect x="122" y="175" width="18" height="52" rx="9" fill="#7a6840" />

      {/* Knee pads / trouser break */}
      <ellipse cx="109" cy="182" rx="11" ry="7" fill="#8a7848" />
      <ellipse cx="131" cy="178" rx="12" ry="7" fill="#96844e" />

      {/* Belt */}
      <rect x="98" y="165" width="52" height="11" rx="5" fill="#4a3008" />
      <rect x="116" y="166" width="14" height="9"  rx="2" fill="#c0901e" />

      {/* Torso — main khaki block */}
      <rect x="99" y="108" width="50" height="60" rx="14" fill="#8b7850" />
      {/* Torso shadow side */}
      <rect x="99" y="108" width="16" height="60" rx="10" fill="#70603a" opacity="0.45" />
      {/* Chest pocket */}
      <rect x="105" y="120" width="16" height="13" rx="3" fill="#70603a" opacity="0.5" />

      {/* Rear arm — trails back slightly, hand near rifle stock */}
      <path d="M102 120 Q90 145 92 165" stroke="#7a6840" strokeWidth="15" fill="none" strokeLinecap="round"/>
      <circle cx="92" cy="165" r="9" fill="#c8906a" />

      {/* Forward arm — extends toward rifle fore-end */}
      <path d="M145 118 Q170 112 192 114" stroke="#8b7850" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <circle cx="192" cy="114" r="10" fill="#c8906a" />

      {/* ── Rifle ── */}
      {/* Butt/stock near rear hand */}
      <rect x="86"  y="154" width="50" height="14" rx="6" fill="#5a3810" />
      {/* Action body */}
      <rect x="130" y="104" width="52" height="14" rx="5" fill="#222" />
      {/* Barrel — long, pointing right */}
      <rect x="178" y="106" width="82" height="9"  rx="3" fill="#2e2e2e" />
      {/* Scope */}
      <rect x="138" y="97"  width="28" height="11" rx="3" fill="#1a1a1a" />
      <rect x="148" y="94"  width="9"  height="7"  rx="2" fill="#2e2e2e" />
      {/* Trigger guard */}
      <path d="M154 118 Q150 130 156 128 Q162 130 158 118" stroke="#111" strokeWidth="2" fill="#333"/>

      {/* Neck */}
      <rect x="108" y="94" width="20" height="18" rx="10" fill="#c8906a" />

      {/* Head — clear circle, facing right */}
      <circle cx="120" cy="76" r="26" fill="#d4956a" />
      {/* Cheek/jaw shadow */}
      <path d="M106 82 Q120 92 134 84" fill="#c07848" opacity="0.38" />
      {/* Ear */}
      <ellipse cx="98" cy="78" rx="7" ry="9" fill="#c08858" />

      {/* ── Safari hat ── */}
      {/* Brim — wide and flat, the most readable part */}
      <ellipse cx="122" cy="55" rx="38" ry="12" fill="#7a5818" />
      {/* Crown */}
      <path d="M92 55 Q94 26 121 20 Q148 26 150 55 Z" fill="#966c1e" />
      {/* Hat band */}
      <rect x="92" y="51" width="58" height="7" rx="3" fill="#523808" />
      {/* Crown highlight */}
      <ellipse cx="116" cy="34" rx="14" ry="6" fill="rgba(255,210,100,0.22)" />

      {/* Eye */}
      <circle cx="135" cy="78" r="5"   fill="#fffde0" />
      <circle cx="136" cy="78" r="3.2" fill="#1a1008" />
      <circle cx="137" cy="77" r="1.2" fill="white"   />

      {/* Nose profile */}
      <path d="M140 82 Q145 89 142 94" stroke="#b07050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

      {/* Mouth — determined expression */}
      <path d="M132 92 Q140 96 144 93" stroke="#8a4e28" strokeWidth="2" fill="none" strokeLinecap="round"/>
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
