// Pure CSS/SVG background — no canvas, no heavy deps
export default function HomeBackground() {
  return (
    <div className="home-animated absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">

      {/* ── 1. Sky gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #1a88d8 0%, #4ab8f0 30%, #88d8f8 55%, #c8ecf8 72%, #dff0e0 82%, #a8d870 92%, #68b840 100%)",
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
          background: "radial-gradient(circle at 38% 35%, #fffde0 0%, #ffe060 35%, #ffb800 65%, transparent 100%)",
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

      {/* ── 4. Distant mountain range ── */}
      <svg
        viewBox="0 0 900 260"
        className="absolute"
        style={{ bottom: "22%", left: 0, width: "55%", pointerEvents: "none" }}
        preserveAspectRatio="xMinYMax meet"
        aria-hidden="true"
      >
        {/* Farthest range — pale lavender blue, barely visible */}
        <path
          d="M0 260 L0 180 Q60 110 130 145 Q180 85 240 125 Q290 60 360 105 Q410 45 470 90 Q520 30 580 75 Q640 55 700 88 Q750 40 820 70 L900 80 L900 260 Z"
          fill="#99aec8"
          opacity="0.45"
        />
        {/* Mid range — blue-grey, clearer peaks */}
        <path
          d="M0 260 L0 195 Q50 140 110 165 Q160 100 215 140 Q260 72 318 115 Q365 55 420 98 Q468 38 524 80 Q575 52 628 82 Q678 30 740 68 Q790 48 850 75 L900 82 L900 260 Z"
          fill="#7a95b5"
          opacity="0.62"
        />
        {/* Near range — darker blue-grey, defined peaks */}
        <path
          d="M0 260 L0 210 Q40 162 95 182 Q138 118 188 158 Q228 85 275 130 Q314 68 360 108 Q398 52 445 92 Q485 72 520 95 Q560 42 608 78 Q645 58 685 82 L900 140 L900 260 Z"
          fill="#5d7a9e"
          opacity="0.75"
        />
        {/* Snow caps on two tallest peaks */}
        <path d="M272 130 Q278 85 284 130 Z" fill="white" opacity="0.7"/>
        <path d="M357 108 Q363 68 368 108 Z" fill="white" opacity="0.65"/>
        <path d="M521 95 Q527 58 533 95 Z" fill="white" opacity="0.6"/>
        {/* Atmospheric haze at the base of the mountains */}
        <rect x="0" y="230" width="900" height="30" fill="url(#mountainHaze)" opacity="0.5"/>
        <defs>
          <linearGradient id="mountainHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(180,220,255,0)" />
            <stop offset="100%" stopColor="rgba(180,220,255,0.6)" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── 5. Savanna midground warm strip ── */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: "14%",
          height: "20%",
          background: "linear-gradient(180deg, transparent 0%, rgba(210,170,80,0.18) 40%, rgba(180,140,50,0.25) 100%)",
        }}
      />

      {/* ── 6. Ground green gradient ── */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: "26%",
          background: "linear-gradient(180deg, #78c840 0%, #52a028 40%, #3a8018 80%, #286010 100%)",
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
        style={{ height: "12%", background: "linear-gradient(180deg, #2a7818 0%, #1a5010 100%)" }}
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
