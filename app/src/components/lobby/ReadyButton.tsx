interface ReadyButtonProps {
  isReady: boolean;
  canStart: boolean;
  allReady: boolean;
  playerCount: number;
  onReady: () => void;
  onStart: () => void;
  isHost?: boolean;
}

export default function ReadyButton({
  isReady,
  canStart,
  allReady,
  playerCount,
  onReady,
  isHost = false,
}: ReadyButtonProps) {
  const minPlayers = 2;
  const waitingForMore = playerCount < minPlayers;

  let label = "Ready Up";
  let btnClass =
    "bg-[#3db02a] hover:bg-[#4ecf35] active:bg-[#2a8c1e] border-[#7fff00] text-white shadow-[0_0_22px_rgba(127,255,0,0.45)]";
  let disabled = false;

  if (waitingForMore) {
    label = `Waiting for Players (${playerCount}/${minPlayers})`;
    btnClass = "bg-[#3a3a3a] border-[#555] text-[#888] cursor-not-allowed";
    disabled = true;
  } else if (isReady) {
    if (allReady && isHost) {
      label = "🚀 Start Match!";
      btnClass =
        "bg-[#d4a010] hover:bg-[#e8b520] active:bg-[#b88c0a] border-[#f5d07a] text-black shadow-[0_0_22px_rgba(212,160,16,0.5)]";
    } else if (allReady) {
      label = "✓ Ready — Starting...";
      btnClass = "bg-[#1a7c10] border-[#7fff00] text-[#7fff00] animate-pulse cursor-default";
    } else {
      label = "✓ Ready — Tap to Unready";
      btnClass = "bg-[#1a7c10] hover:bg-[#228c18] active:bg-[#146010] border-[#7fff00] text-[#7fff00]";
    }
  }

  const handlePress = (e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled) return;
    onReady();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onPointerDown={handlePress}
        disabled={disabled}
        className={[
          "px-10 py-4 rounded-2xl border-2 font-extrabold text-lg tracking-widest uppercase",
          "transition-all duration-150 select-none min-w-[220px] min-h-[58px]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
          btnClass,
          !disabled && !isReady ? "active:scale-95" : "",
          isReady && canStart ? "scale-105" : "",
        ].join(" ")}
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)", touchAction: "manipulation" }}
      >
        {label}
      </button>
      {isReady && !allReady && (
        <p className="text-[#c8a05a] text-xs animate-pulse">Waiting for others to ready up...</p>
      )}
    </div>
  );
}
