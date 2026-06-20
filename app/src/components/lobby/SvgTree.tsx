// Central acacia/safari tree — pure SVG, no external deps
export default function SvgTree({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 420"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Trunk */}
      <path d="M148 420 Q144 360 138 300 Q134 260 148 220" stroke="#6b3a1f" strokeWidth="22" fill="none" strokeLinecap="round"/>
      <path d="M172 420 Q176 360 182 300 Q186 260 172 220" stroke="#7c4522" strokeWidth="18" fill="none" strokeLinecap="round"/>
      <path d="M148 420 L172 420 Q180 380 182 340 Q184 300 172 220 Q160 200 148 220 Q136 260 138 300 Q136 340 148 420Z" fill="#7c4522"/>
      {/* Root bumps */}
      <ellipse cx="140" cy="418" rx="20" ry="6" fill="#5a3010"/>
      <ellipse cx="175" cy="418" rx="18" ry="5" fill="#5a3010"/>

      {/* Branch left */}
      <path d="M148 260 Q110 230 80 200" stroke="#6b3a1f" strokeWidth="12" fill="none" strokeLinecap="round"/>
      {/* Branch right */}
      <path d="M168 250 Q208 220 238 190" stroke="#6b3a1f" strokeWidth="11" fill="none" strokeLinecap="round"/>
      {/* Branch up-left */}
      <path d="M155 230 Q140 190 125 150" stroke="#6b3a1f" strokeWidth="9" fill="none" strokeLinecap="round"/>
      {/* Branch up-right */}
      <path d="M165 225 Q185 185 205 145" stroke="#6b3a1f" strokeWidth="8" fill="none" strokeLinecap="round"/>

      {/* Canopy layers — dark backs first */}
      <ellipse cx="160" cy="120" rx="115" ry="55" fill="#1a5c0a" opacity="0.7"/>
      <ellipse cx="90" cy="155" rx="70" ry="38" fill="#1a5c0a" opacity="0.6"/>
      <ellipse cx="228" cy="148" rx="68" ry="36" fill="#1a5c0a" opacity="0.6"/>

      {/* Mid canopy */}
      <ellipse cx="160" cy="105" rx="108" ry="50" fill="#2a7c14"/>
      <ellipse cx="88" cy="140" rx="62" ry="35" fill="#248012"/>
      <ellipse cx="230" cy="135" rx="60" ry="33" fill="#248012"/>

      {/* Top canopy — lighter */}
      <ellipse cx="160" cy="88" rx="95" ry="44" fill="#38a01c"/>
      <ellipse cx="105" cy="118" rx="52" ry="30" fill="#3aaa1e"/>
      <ellipse cx="216" cy="112" rx="55" ry="30" fill="#3aaa1e"/>

      {/* Highlight puffs */}
      <ellipse cx="155" cy="72" rx="55" ry="26" fill="#4ec828" opacity="0.7"/>
      <ellipse cx="188" cy="85" rx="40" ry="22" fill="#4ec828" opacity="0.5"/>
      <ellipse cx="122" cy="92" rx="38" ry="20" fill="#4ec828" opacity="0.5"/>

      {/* Glint */}
      <ellipse cx="145" cy="62" rx="20" ry="10" fill="#80f040" opacity="0.35"/>
    </svg>
  );
}
