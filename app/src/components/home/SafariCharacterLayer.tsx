import SvgTree from "../lobby/SvgTree";

// Character layer: hunter (left), tree (right), and a rabbit hiding in the grass.
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

      {/* ── Rabbit — bottom-right foreground, tucked near the tree line ── */}
      <div
        className="absolute"
        style={{
          right: "17%",
          bottom: "8%",
          width: "clamp(120px, 15vw, 220px)",
          filter: "drop-shadow(2px 5px 8px rgba(0,0,0,0.4))",
        }}
      >
        <RabbitSvg />
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

// ── Rabbit SVG: low, alert, and a better thematic fit for hide-and-seek ──
function RabbitSvg() {
  return (
    <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="100" cy="170" rx="72" ry="10" fill="rgba(0,0,0,0.22)" />

      {/* Back feet */}
      <ellipse cx="72" cy="153" rx="18" ry="12" fill="#7a6a57" />
      <ellipse cx="124" cy="153" rx="18" ry="12" fill="#7a6a57" />

      {/* Body */}
      <ellipse cx="100" cy="121" rx="54" ry="34" fill="#e9e3d6" />
      <ellipse cx="100" cy="126" rx="40" ry="22" fill="#d9d1c5" opacity="0.55" />

      {/* Tail puff */}
      <g
        style={{
          animation: "rabbitTail 1.8s ease-in-out infinite",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      >
        <circle cx="146" cy="124" r="12" fill="#f7f3ec" />
        <circle cx="146" cy="124" r="6" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Head */}
      <ellipse cx="75" cy="94" rx="30" ry="26" fill="#f4efe6" />
      <ellipse cx="64" cy="84" rx="10" ry="16" fill="#efe7db" transform="rotate(-20 64 84)" />
      <ellipse cx="84" cy="82" rx="10" ry="18" fill="#efe7db" transform="rotate(12 84 82)" />
      <ellipse cx="64" cy="79" rx="5" ry="10" fill="#d6a2b3" transform="rotate(-20 64 79)" />
      <ellipse cx="84" cy="77" rx="5" ry="11" fill="#d6a2b3" transform="rotate(12 84 77)" />

      {/* Eye and nose */}
      <circle cx="83" cy="95" r="3.5" fill="#1c1712" />
      <circle cx="84" cy="94" r="1.1" fill="white" />
      <path d="M67 104 Q75 110 83 104" stroke="#70503f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="64" cy="102" r="4" fill="#c08078" />

      {/* Forepaws */}
      <path d="M82 137 Q78 151 80 160" stroke="#7c6e63" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M110 139 Q116 151 112 160" stroke="#7c6e63" strokeWidth="10" fill="none" strokeLinecap="round" />

      {/* Ear shadows / whiskers */}
      <path d="M52 100 L34 94" stroke="#b79f8d" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 106 L32 106" stroke="#b79f8d" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 112 L34 118" stroke="#b79f8d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
