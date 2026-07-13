// Pure CSS/SVG background — no canvas, no heavy deps
export default function HomeBackground() {
  return (
    <div className="home-animated absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">

      {/* ── 1. Sky gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #498099 0%, #30c0b7 42%, #bdeae0 68%, #fff5de 82%, #fd8083 100%)",
        }}
      />

      {/* ── 2. Sun ── */}
      <div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          top: "6%",
          left: "52%",
          background: "radial-gradient(circle at 38% 35%, #fff5de 0%, #ffd45c 55%, #ee227d 72%, transparent 74%)",
          animation: "sunPulse 5s ease-in-out infinite",
        }}
      />

      {/* ── 3. Clouds ── */}
      {/* Cloud 1 — large, left */}
      <div
        className="absolute"
        style={{ top: "8%", left: "4%", animation: "cloudDrift 28s ease-in-out infinite alternate" }}
      >
        <Cloud width={220} opacity={0.96} />
      </div>
      {/* Cloud 2 — medium, upper right */}
      <div
        className="absolute"
        style={{ top: "5%", right: "8%", animation: "cloudDriftSlow 22s ease-in-out infinite alternate-reverse" }}
      >
        <Cloud width={160} opacity={0.88} />
      </div>
      {/* Cloud 3 — small, upper center */}
      <div
        className="absolute"
        style={{ top: "14%", left: "38%", animation: "cloudDrift 35s ease-in-out infinite alternate" }}
      >
        <Cloud width={110} opacity={0.75} />
      </div>
      {/* Cloud 4 — tiny, far right */}
      <div
        className="absolute"
        style={{ top: "18%", right: "22%", animation: "cloudDriftSlow 30s ease-in-out 4s infinite alternate" }}
      >
        <Cloud width={90} opacity={0.65} />
      </div>

      {/* ── 4. Distant mountain range — full width, sharp triangular peaks ── */}
      <svg
        viewBox="0 0 1400 380"
        className="absolute left-0 right-0"
        style={{ bottom: "20%", width: "100%", height: "38%", pointerEvents: "none" }}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="farMtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7e8e4"/>
            <stop offset="100%" stopColor="#498099"/>
          </linearGradient>
          <linearGradient id="midMtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fd8083"/>
            <stop offset="100%" stopColor="#852467"/>
          </linearGradient>
          <linearGradient id="nearMtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#852467"/>
            <stop offset="100%" stopColor="#3b0855"/>
          </linearGradient>
        </defs>

        {/* Far range — light blue-grey, gentle but pointed peaks */}
        <path
          d="M0 380 L0 260
             L70 220 L140 165 L200 210
             L280 140 L340 195
             L420 115 L480 170
             L560 100 L610 155
             L680 120 L740 160
             L820 90  L880 140
             L950 110 L1010 150
             L1090 125 L1150 160
             L1230 105 L1290 155
             L1360 130 L1400 145
             L1400 380 Z"
          fill="url(#farMtnGrad)"
          opacity="0.55"
        />

        {/* Mid range — medium blue-grey, sharper peaks */}
        <path
          d="M0 380 L0 300
             L60 268 L110 225 L165 265
             L230 195 L285 240
             L350 165 L400 215
             L465 145 L515 195
             L575 162 L625 198
             L685 148 L730 182
             L795 135 L845 175
             L910 152 L960 185
             L1025 145 L1075 180
             L1140 158 L1190 190
             L1260 148 L1320 178
             L1380 155 L1400 165
             L1400 380 Z"
          fill="url(#midMtnGrad)"
          opacity="0.70"
        />

        {/* Near range — darker, tallest visible peaks, cleanest silhouette */}
        <path
          d="M0 380 L0 330
             L50 308 L95 278 L140 310
             L195 255 L245 295
             L305 235 L355 272
             L415 215 L460 258
             L515 240 L555 268
             L608 225 L648 260
             L700 238 L740 265
             L800 218 L848 255
             L905 235 L950 265
             L1010 238 L1055 268
             L1115 228 L1165 262
             L1230 240 L1285 268
             L1350 245 L1400 258
             L1400 380 Z"
          fill="url(#nearMtnGrad)"
          opacity="0.82"
        />

        {/* Snow caps — white triangles on the three sharpest far/mid peaks */}
        <polygon points="560,100 585,148 535,148" fill="white" opacity="0.80"/>
        <polygon points="820,90  848,135 792,135" fill="white" opacity="0.75"/>
        <polygon points="1230,105 1258,152 1202,152" fill="white" opacity="0.70"/>
        {/* Lighter snow on mid-range peaks */}
        <polygon points="350,165 368,200 332,200" fill="rgba(255,255,255,0.55)"/>
        <polygon points="685,148 702,180 668,180" fill="rgba(255,255,255,0.50)"/>
      </svg>

      {/* ── 5. Savanna midground warm strip ── */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: "14%",
          height: "20%",
          background: "linear-gradient(180deg, transparent 0%, rgba(255,245,222,0.3) 40%, rgba(253,128,131,0.28) 100%)",
        }}
      />

      {/* ── 6. Ground green gradient ── */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: "26%",
          background: "linear-gradient(180deg, #86c96b 0%, #4fa65e 42%, #28735f 82%, #19534e 100%)",
        }}
      />

      {/* ── 7. Ground grass blade texture strip ── */}
      <svg
        viewBox="0 0 1200 80"
        className="absolute left-0 right-0"
        style={{ bottom: "22%", width: "100%", height: 80 }}
        preserveAspectRatio="none"
      >
        {Array.from({ length: 60 }, (_, i) => {
          const x = (i / 60) * 1200;
          const h = 28 + ((i * 17) % 30);
          const sway = (i % 2 === 0) ? -4 : 4;
          return (
            <path
              key={i}
              d={`M${x} 80 Q${x + sway} ${80 - h * 0.5} ${x + sway * 1.5} ${80 - h}`}
              stroke={i % 3 === 0 ? "#2a7010" : i % 3 === 1 ? "#3a9018" : "#4ab020"}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* ── 8. Foreground dark grass strip ── */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ height: "12%", background: "linear-gradient(180deg, #28735f 0%, #3b0855 100%)" }}
      />
    </div>
  );
}

function Cloud({ width, opacity }: { width: number; opacity: number }) {
  const h = width * 0.45;
  return (
    <svg viewBox="0 0 200 90" style={{ width, height: h, opacity }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cloudBlur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {/* Shadow */}
      <ellipse cx="100" cy="88" rx="85" ry="8" fill="rgba(100,150,200,0.12)" />
      {/* Main puffs */}
      <circle cx="70"  cy="55" r="34" fill="white" />
      <circle cx="105" cy="45" r="42" fill="white" />
      <circle cx="143" cy="54" r="30" fill="white" />
      <circle cx="50"  cy="63" r="22" fill="white" />
      <circle cx="165" cy="62" r="20" fill="white" />
      {/* Top bright highlight */}
      <circle cx="100" cy="36" r="26" fill="rgba(255,255,255,0.7)" />
      {/* Subtle blue shade on bottom */}
      <ellipse cx="100" cy="72" rx="78" ry="12" fill="rgba(180,210,240,0.25)" />
    </svg>
  );
}
