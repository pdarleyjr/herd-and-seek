interface ModeSelectProps {
  onMultiplayer: () => void;
  onSolo: () => void;
  onOpenWorld: () => void;
}

const CARD = "w-full max-w-sm rounded-2xl p-6 text-left border-2 border-white/10 bg-white/5 hover:bg-white/10 transition min-h-[120px]";

export default function ModeSelect({ onMultiplayer, onSolo, onOpenWorld }: ModeSelectProps) {
  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-extrabold tracking-tight">🦓 Herd &amp; Seek</h1>
      <p className="text-white/60 text-center max-w-md">Pick how you want to play.</p>
      <div className="flex flex-col gap-4 w-full items-center">
        <button onClick={onMultiplayer} className={CARD}>
          <div className="text-xl font-bold">👥 Multiplayer</div>
          <div className="text-sm text-white/60">Create or join a private room and play hide &amp; seek with friends.</div>
        </button>
        <button onClick={onSolo} className={CARD}>
          <div className="text-xl font-bold">🤖 Solo vs AI</div>
          <div className="text-sm text-white/60">Practice alone against AI animals or an AI hunter.</div>
        </button>
        <button onClick={onOpenWorld} className={CARD}>
          <div className="text-xl font-bold">🌍 Open World</div>
          <div className="text-sm text-white/60">Roam the Savannah Reserve, complete quests, and collect rewards.</div>
        </button>
      </div>
    </div>
  );
}
