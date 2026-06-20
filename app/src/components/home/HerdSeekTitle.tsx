// Bubbly game-font title using CSS text-stroke + layered shadows
// No custom font needed — uses "Arial Black" / system heavy weight

const WORD_STYLE: React.CSSProperties = {
  fontFamily: '"Arial Black", "Helvetica Neue", Impact, "Trebuchet MS", sans-serif',
  fontWeight: 900,
  color: "#fffde0",
  WebkitTextStroke: "7px #4a2208",
  textShadow: [
    "5px 7px 0 #4a2208",
    "0 10px 20px rgba(0,0,0,0.45)",
    "0 2px 0 rgba(255,255,255,0.25)",
  ].join(", "),
  letterSpacing: "0.06em",
  lineHeight: 0.95,
  paintOrder: "stroke fill",
};

const AMP_STYLE: React.CSSProperties = {
  fontFamily: '"Arial Black", "Helvetica Neue", Impact, "Trebuchet MS", sans-serif',
  fontWeight: 900,
  color: "#ff9900",
  WebkitTextStroke: "6px #7a3800",
  textShadow: [
    "4px 6px 0 #7a3800",
    "0 8px 16px rgba(0,0,0,0.4)",
  ].join(", "),
  letterSpacing: "0.04em",
  lineHeight: 0.9,
  paintOrder: "stroke fill",
};

export default function HerdSeekTitle() {
  return (
    <div
      className="home-animated relative flex flex-col items-center select-none"
      style={{ animation: "titleEntrance 0.7s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Decorative leaf clusters flanking the title */}
      <div className="absolute -left-8 top-2 opacity-80" style={{ animation: "leafBob 4s ease-in-out infinite" }}>
        <LeafCluster flip={false} />
      </div>
      <div className="absolute -right-8 top-2 opacity-80" style={{ animation: "leafBob 4s ease-in-out 0.5s infinite" }}>
        <LeafCluster flip />
      </div>

      {/* Backing badge — warm wooden plank */}
      <div
        className="absolute inset-0 -mx-6 -my-3 rounded-3xl"
        style={{
          background: "linear-gradient(160deg, #8b5c1e 0%, #6b3a0a 35%, #7c4a14 60%, #5a2e08 100%)",
          boxShadow: "inset 0 2px 8px rgba(255,200,80,0.18), inset 0 -4px 8px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.5)",
          border: "3px solid #4a2208",
        }}
      />
      {/* Badge rope accent top */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-3/4 h-2 rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, #c8a050 20%, #e8c070 50%, #c8a050 80%, transparent)" }}
      />
      {/* Badge rope accent bottom */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-2 rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, #c8a050 20%, #e8c070 50%, #c8a050 80%, transparent)" }}
      />

      {/* Title text — stacked: HERD / & / SEEK */}
      <h1
        aria-label="Herd and Seek"
        className="relative z-10 flex flex-col items-center px-8 py-4"
      >
        <span
          style={{
            ...WORD_STYLE,
            fontSize: "clamp(52px, 11vw, 124px)",
          }}
        >
          HERD
        </span>
        <span
          style={{
            ...AMP_STYLE,
            fontSize: "clamp(34px, 7vw, 78px)",
          }}
        >
          &amp;
        </span>
        <span
          style={{
            ...WORD_STYLE,
            fontSize: "clamp(52px, 11vw, 124px)",
          }}
        >
          SEEK
        </span>
      </h1>
    </div>
  );
}

function LeafCluster({ flip }: { flip: boolean }) {
  return (
    <svg
      viewBox="0 0 60 80"
      width={52}
      height={72}
      style={{ transform: flip ? "scaleX(-1)" : "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Back leaf */}
      <ellipse cx="20" cy="50" rx="14" ry="28" fill="#2a7010" transform="rotate(-30 20 50)" opacity="0.8"/>
      {/* Mid leaf */}
      <ellipse cx="30" cy="40" rx="12" ry="26" fill="#3a9018" transform="rotate(-10 30 40)"/>
      {/* Front leaf */}
      <ellipse cx="42" cy="48" rx="11" ry="24" fill="#4ab020" transform="rotate(15 42 48)"/>
      {/* Bright highlight leaves */}
      <ellipse cx="35" cy="30" rx="9" ry="20" fill="#5cc828" transform="rotate(-5 35 30)"/>
      {/* Vine stem */}
      <path d="M28 78 Q20 60 24 40 Q28 25 35 15" stroke="#2a7010" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  );
}
