interface NameEntryCardProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error?: string;
}

export default function NameEntryCard({ value, onChange, onSubmit, error }: NameEntryCardProps) {
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= 24;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <div
      className="home-animated flex flex-col items-center gap-2 w-full max-w-lg px-4"
      style={{ animation: "cardEntrance 0.6s cubic-bezier(0.22,1,0.36,1) 0.35s both" }}
    >
      {/* Outer decorative frame */}
      <div
        className="w-full rounded-2xl p-1"
        style={{
          background: "linear-gradient(135deg, #f5c842 0%, #c8860a 40%, #f5c842 70%, #c8860a 100%)",
          boxShadow: "0 6px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(200,130,10,0.4)",
        }}
      >
        {/* Inner form row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-stretch overflow-hidden rounded-xl"
          style={{
            background: "linear-gradient(180deg, #f0e0b0 0%, #e8d098 60%, #d8c080 100%)",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          {/* User icon */}
          <div
            className="flex items-center pl-4 pr-2 text-2xl shrink-0"
            style={{ color: "#8b5c1e" }}
            aria-hidden="true"
          >
            <PersonIcon />
          </div>

          {/* Name input */}
          <div className="flex-1 relative">
            <label htmlFor="home-player-name" className="sr-only">
              Player name
            </label>
            <input
              id="home-player-name"
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && onSubmit()}
              placeholder="Enter your name"
              maxLength={24}
              autoComplete="nickname"
              autoFocus
              className="w-full bg-transparent text-lg py-4 pr-3 focus:outline-none placeholder:text-[#b09060]"
              style={{
                color: "#3d2008",
                fontWeight: 600,
                fontSize: "clamp(15px, 2.5vw, 20px)",
              }}
            />
          </div>

          {/* PLAY button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="shrink-0 px-7 font-extrabold tracking-widest uppercase select-none transition-all duration-100"
            style={{
              fontSize: "clamp(14px, 2.5vw, 20px)",
              background: canSubmit
                ? "linear-gradient(180deg, #ffb820 0%, #e88010 50%, #cc6808 100%)"
                : "linear-gradient(180deg, #c8a870 0%, #a88850 100%)",
              color: canSubmit ? "#fff" : "#c8a870",
              borderLeft: "3px solid rgba(0,0,0,0.15)",
              textShadow: canSubmit ? "0 2px 4px rgba(0,0,0,0.4)" : "none",
              boxShadow: canSubmit ? "inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              minWidth: 90,
              letterSpacing: "0.12em",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }}
          >
            PLAY
          </button>
        </form>
      </div>

      {/* Validation error */}
      {error && (
        <p
          className="text-sm font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "rgba(180,40,20,0.82)", color: "#ffe0d0" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Subtle tip */}
      <p
        className="text-xs text-center"
        style={{ color: "rgba(255,255,255,0.75)", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
      >
        Press <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 font-mono">Enter</kbd> to play
      </p>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
