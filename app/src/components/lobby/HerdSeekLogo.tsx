export default function HerdSeekLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col leading-none select-none ${className}`}>
      <div
        className="font-extrabold tracking-wider"
        style={{
          fontSize: "clamp(22px, 4vw, 38px)",
          background: "linear-gradient(135deg, #ffe070 0%, #f5a020 50%, #e06010 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: "none",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
        }}
      >
        HERD &amp;
      </div>
      <div
        className="font-extrabold tracking-wider"
        style={{
          fontSize: "clamp(26px, 5vw, 46px)",
          background: "linear-gradient(135deg, #7fff00 0%, #40c010 50%, #208008 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: "none",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
        }}
      >
        SEEK
      </div>
      <div
        className="text-[#c8a05a] font-semibold tracking-widest uppercase"
        style={{ fontSize: "clamp(8px, 1.2vw, 11px)", letterSpacing: "0.25em" }}
      >
        Hide. Blend. Survive.
      </div>
    </div>
  );
}
