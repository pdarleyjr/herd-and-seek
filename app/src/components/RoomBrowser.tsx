import { useState } from "react";
import { normalizeRoomCode } from "../room";

interface RoomBrowserProps {
  onCreate: (code: string) => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}

export default function RoomBrowser({ onCreate, onJoin, onBack }: RoomBrowserProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const join = () => {
    const norm = normalizeRoomCode(code);
    if (norm.length < 4) {
      setError("Enter a valid room code, e.g. ABCD-EFGH");
      return;
    }
    setError("");
    onJoin(norm);
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-extrabold">Multiplayer Room</h1>

      <button
        onClick={() => onCreate("")}
        className="w-full max-w-sm rounded-2xl p-6 text-left border-2 border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 transition min-h-[96px]"
      >
        <div className="text-xl font-bold">➕ Create a Room</div>
        <div className="text-sm text-white/60">Generate a private room and share the code with a friend.</div>
      </button>

      <div className="w-full max-w-sm rounded-2xl p-5 border-2 border-white/10 bg-white/5 flex flex-col gap-3">
        <div className="text-lg font-bold">Join with a code</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD-EFGH"
          inputMode="text"
          className="w-full rounded-lg px-3 py-3 bg-black/40 border border-white/20 font-mono tracking-widest uppercase text-center text-lg min-h-[48px]"
          onKeyDown={(e) => { if (e.key === "Enter") join(); }}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={join}
          className="w-full rounded-xl px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold min-h-[52px]"
        >
          Join Room
        </button>
      </div>

      <button onClick={onBack} className="text-sm text-white/60 underline">← Back</button>
    </div>
  );
}
