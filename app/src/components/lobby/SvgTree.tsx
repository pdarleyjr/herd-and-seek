// Central safari acacia tree — rich SVG, no external deps
export default function SvgTree({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 480"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Bark gradient — warm dark-brown to mid-brown */}
        <linearGradient id="bark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b1e09" />
          <stop offset="30%" stopColor="#6b3a1a" />
          <stop offset="60%" stopColor="#8c4d22" />
          <stop offset="100%" stopColor="#4a2510" />
        </linearGradient>

        {/* Branch gradient */}
        <linearGradient id="branch" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5a3010" />
          <stop offset="100%" stopColor="#7c4520" />
        </linearGradient>

        {/* Foliage back shadow */}
        <radialGradient id="foliageShadow" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#14500a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a3005" stopOpacity="0.6" />
        </radialGradient>

        {/* Foliage mid */}
        <radialGradient id="foliageMid" cx="40%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#2d8c14" />
          <stop offset="100%" stopColor="#1a6009" />
        </radialGradient>

        {/* Foliage bright */}
        <radialGradient id="foliageBright" cx="35%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#52c42a" />
          <stop offset="55%" stopColor="#38a01c" />
          <stop offset="100%" stopColor="#248010" />
        </radialGradient>

        {/* Sun-lit highlight */}
        <radialGradient id="sunlit" cx="30%" cy="25%" r="45%">
          <stop offset="0%" stopColor="#90f040" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#52c42a" stopOpacity="0" />
        </radialGradient>

        {/* Root shadow */}
        <radialGradient id="rootShadow" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Ground shadow ellipse */}
      <ellipse cx="170" cy="472" rx="90" ry="12" fill="url(#rootShadow)" />

      {/* ── Trunk ── */}
      {/* Main trunk shape — tapered column */}
      <path
        d="M145 480 C143 430 138 370 136 310 C134 270 140 240 152 215 L170 210 L188 215 C200 240 206 270 204 310 C202 370 197 430 195 480 Z"
        fill="url(#bark)"
      />
      {/* Trunk highlight (left light stripe) */}
      <path
        d="M155 480 C153 430 150 370 149 310 C148 270 152 242 159 218 L163 216 C158 242 156 272 157 312 C158 372 161 432 163 480 Z"
        fill="#a06030"
        opacity="0.45"
      />
      {/* Trunk dark edge right */}
      <path
        d="M185 480 C187 430 192 370 193 310 C194 270 190 242 183 218 L180 216 C185 242 187 272 186 312 C185 372 183 432 183 480 Z"
        fill="#2a1208"
        opacity="0.4"
      />

      {/* Root bumps */}
      <ellipse cx="148" cy="476" rx="22" ry="7" fill="#4a2510" />
      <ellipse cx="192" cy="476" rx="20" ry="6" fill="#4a2510" />
      <ellipse cx="170" cy="478" rx="15" ry="5" fill="#3b1e09" />

      {/* ── Branches ── */}
      {/* Branch left-low */}
      <path
        d="M148 295 Q105 268 72 240"
        stroke="url(#branch)" strokeWidth="14" fill="none" strokeLinecap="round"
      />
      {/* Branch left-low sub-branches */}
      <path d="M100 265 Q85 250 75 232" stroke="#6b3a1a" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <path d="M88 254 Q70 245 58 238" stroke="#6b3a1a" strokeWidth="5" fill="none" strokeLinecap="round"/>

      {/* Branch right-low */}
      <path
        d="M192 285 Q235 255 268 225"
        stroke="url(#branch)" strokeWidth="13" fill="none" strokeLinecap="round"
      />
      <path d="M240 248 Q258 238 272 222" stroke="#6b3a1a" strokeWidth="6" fill="none" strokeLinecap="round"/>

      {/* Branch up-left */}
      <path
        d="M155 240 Q132 195 118 150"
        stroke="url(#branch)" strokeWidth="11" fill="none" strokeLinecap="round"
      />
      <path d="M128 185 Q112 172 100 155" stroke="#6b3a1a" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M120 168 Q105 152 96 138" stroke="#5a3010" strokeWidth="4" fill="none" strokeLinecap="round"/>

      {/* Branch up-right */}
      <path
        d="M185 232 Q212 188 228 142"
        stroke="url(#branch)" strokeWidth="10" fill="none" strokeLinecap="round"
      />
      <path d="M215 178 Q230 162 242 148" stroke="#6b3a1a" strokeWidth="5" fill="none" strokeLinecap="round"/>

      {/* Branch top-center */}
      <path
        d="M170 218 Q168 178 165 140"
        stroke="url(#branch)" strokeWidth="9" fill="none" strokeLinecap="round"
      />

      {/* ── Foliage — layered from back to front ── */}

      {/* Layer 0: deep background shadow blobs */}
      <ellipse cx="170" cy="128" rx="128" ry="58" fill="#0d4005" opacity="0.75" />
      <ellipse cx="90"  cy="168" rx="74"  ry="40" fill="#0d4005" opacity="0.6"  />
      <ellipse cx="252" cy="158" rx="72"  ry="38" fill="#0d4005" opacity="0.6"  />

      {/* Layer 1: dark mid back */}
      <ellipse cx="170" cy="115" rx="118" ry="54" fill="url(#foliageShadow)" />
      <ellipse cx="92"  cy="153" rx="66"  ry="37" fill="#135c08" />
      <ellipse cx="248" cy="145" rx="64"  ry="36" fill="#135c08" />
      <ellipse cx="120" cy="100" rx="54"  ry="30" fill="#135c08" />
      <ellipse cx="218" cy="94"  rx="56"  ry="30" fill="#135c08" />

      {/* Layer 2: mid green */}
      <ellipse cx="170" cy="100" rx="110" ry="50" fill="url(#foliageMid)" />
      <ellipse cx="95"  cy="138" rx="60"  ry="34" fill="#248012" />
      <ellipse cx="246" cy="130" rx="58"  ry="33" fill="#248012" />
      <ellipse cx="126" cy="88"  rx="50"  ry="28" fill="#248012" />
      <ellipse cx="215" cy="82"  rx="52"  ry="28" fill="#248012" />

      {/* Layer 3: bright lime canopy */}
      <ellipse cx="170" cy="84"  rx="100" ry="46" fill="url(#foliageBright)" />
      <ellipse cx="100" cy="120" rx="54"  ry="30" fill="#38a81c" />
      <ellipse cx="242" cy="114" rx="52"  ry="29" fill="#38a81c" />
      <ellipse cx="130" cy="72"  rx="46"  ry="26" fill="#38a81c" />
      <ellipse cx="212" cy="68"  rx="48"  ry="26" fill="#38a81c" />

      {/* Layer 4: bright top puffs */}
      <ellipse cx="170" cy="66"  rx="84"  ry="38" fill="#4ec028" />
      <ellipse cx="138" cy="55"  rx="50"  ry="28" fill="#52c42a" />
      <ellipse cx="202" cy="52"  rx="52"  ry="27" fill="#52c42a" />
      <ellipse cx="105" cy="100" rx="40"  ry="22" fill="#48b822" />
      <ellipse cx="235" cy="96"  rx="40"  ry="22" fill="#48b822" />

      {/* Layer 5: sun-lit highlight overlay */}
      <ellipse cx="155" cy="55"  rx="78"  ry="34" fill="url(#sunlit)" />

      {/* Layer 6: tiny bright edge puffs (top of canopy) */}
      <ellipse cx="145" cy="40"  rx="34"  ry="18" fill="#70e030" opacity="0.8" />
      <ellipse cx="195" cy="37"  rx="36"  ry="18" fill="#70e030" opacity="0.75"/>
      <ellipse cx="170" cy="30"  rx="28"  ry="15" fill="#88f040" opacity="0.7" />

      {/* Specular glint */}
      <ellipse cx="148" cy="34"  rx="14"  ry="7"  fill="#b8ff70" opacity="0.45" />

      {/* ── Hanging vine details on lower canopy ── */}
      <path d="M100 155 Q98 170 102 182" stroke="#1a6009" strokeWidth="2" fill="none" opacity="0.6"/>
      <path d="M115 162 Q113 178 118 190" stroke="#1a6009" strokeWidth="2" fill="none" opacity="0.5"/>
      <path d="M240 148 Q242 162 238 174" stroke="#1a6009" strokeWidth="2" fill="none" opacity="0.6"/>

      {/* ── Leaf clusters on the two bare side branches ── */}

      {/* LEFT branch tip: M148 295 Q105 268 72 240 → tip at ~(72,240) */}
      {/* Background shadow blobs */}
      <ellipse cx="66"  cy="235" rx="30" ry="18" fill="#0d4005" opacity="0.7" />
      <ellipse cx="82"  cy="245" rx="24" ry="15" fill="#0d4005" opacity="0.6" />
      <ellipse cx="56"  cy="248" rx="22" ry="14" fill="#0d4005" opacity="0.55"/>
      {/* Mid green */}
      <ellipse cx="66"  cy="232" rx="28" ry="17" fill="#1a6009" />
      <ellipse cx="82"  cy="242" rx="22" ry="14" fill="#1a6009" />
      <ellipse cx="54"  cy="244" rx="20" ry="13" fill="#1a6009" />
      {/* Bright top */}
      <ellipse cx="65"  cy="227" rx="24" ry="14" fill="#2d8c14" />
      <ellipse cx="80"  cy="237" rx="19" ry="12" fill="#2d8c14" />
      <ellipse cx="53"  cy="239" rx="18" ry="11" fill="#2d8c14" />
      {/* Lime highlight */}
      <ellipse cx="64"  cy="222" rx="18" ry="10" fill="#4ec028" />
      <ellipse cx="78"  cy="231" rx="14" ry="8"  fill="#4ec028" />
      {/* Sunlit glint */}
      <ellipse cx="60"  cy="218" rx="10" ry="6"  fill="#80f040" opacity="0.55"/>
      {/* Sub-branch leaves at ~(75,232) and (88,254) */}
      <ellipse cx="90"  cy="254" rx="16" ry="10" fill="#1a6009" />
      <ellipse cx="90"  cy="251" rx="13" ry="8"  fill="#38a01c" />
      <ellipse cx="76"  cy="232" rx="12" ry="8"  fill="#2d8c14" />

      {/* RIGHT branch tip: M192 285 Q235 255 268 225 → tip at ~(268,225) */}
      <ellipse cx="274" cy="220" rx="30" ry="18" fill="#0d4005" opacity="0.7" />
      <ellipse cx="258" cy="230" rx="24" ry="15" fill="#0d4005" opacity="0.6" />
      <ellipse cx="284" cy="232" rx="22" ry="14" fill="#0d4005" opacity="0.55"/>
      {/* Mid green */}
      <ellipse cx="274" cy="217" rx="28" ry="17" fill="#1a6009" />
      <ellipse cx="258" cy="227" rx="22" ry="14" fill="#1a6009" />
      <ellipse cx="284" cy="229" rx="20" ry="13" fill="#1a6009" />
      {/* Bright top */}
      <ellipse cx="275" cy="212" rx="24" ry="14" fill="#2d8c14" />
      <ellipse cx="259" cy="222" rx="19" ry="12" fill="#2d8c14" />
      <ellipse cx="285" cy="224" rx="18" ry="11" fill="#2d8c14" />
      {/* Lime highlight */}
      <ellipse cx="275" cy="207" rx="18" ry="10" fill="#4ec028" />
      <ellipse cx="260" cy="217" rx="14" ry="8"  fill="#4ec028" />
      {/* Sunlit glint */}
      <ellipse cx="272" cy="203" rx="10" ry="6"  fill="#80f040" opacity="0.55"/>
      {/* Sub-branch leaves at ~(258,238) */}
      <ellipse cx="258" cy="238" rx="16" ry="10" fill="#1a6009" />
      <ellipse cx="258" cy="235" rx="13" ry="8"  fill="#38a01c" />
    </svg>
  );
}
