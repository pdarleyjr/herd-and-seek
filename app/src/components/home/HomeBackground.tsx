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

      {/* ── 4. Distant mesa / mountain silhouette (left) ── */}
      <svg
        viewBox="0 0 400 160"
        className="absolute"
        style={{ bottom: "28%", left: 0, width: "42%", opacity: 0.55 }}
        preserveAspectRatio="xMinYMax meet"
      >
        {/* Distant flat-top mesa */}
        <path d="M0 160 L0 90 Q40 60 80 75 Q110 55 140 70 Q165 40 195 60 Q210 30 240 55 Q280 20 310 50 Q340 35 380 55 L400 60 L400 160 Z" fill="#c8a86e" />
        <path d="M0 160 L0 95 Q30 70 70 80 Q100 62 130 75 Q155 48 185 65 Q200 38 228 58 Q265 28 295 52 Q328 38 370 58 L400 65 L400 160 Z" fill="#d4b478" />
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
