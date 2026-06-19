import { useState, useEffect, useCallback, useRef } from "react";
import { loadAssets, type AssetMap } from "./AssetLoader";
import GameCanvas from "./GameCanvas";
import { useGameSocket } from "./useGameSocket";
import {
  type SerializedState,
  type AnimalType,
  type PerkType,
  ANIMAL_OPTIONS,
  PERK_OPTIONS,
} from "./types";

type Screen = "AUTH" | "LOBBY" | "GAME";

export default function App() {
  const [screen, setScreen] = useState<Screen>("AUTH");
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [assets, setAssets] = useState<AssetMap | null>(null);
  const [gameState, setGameState] = useState<SerializedState | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>("elephant");
  const [selectedPerk, setSelectedPerk] = useState<PerkType>("none");
  const localPosRef = useRef({ x: 100, y: 100 });

  useEffect(() => {
    const savedId = localStorage.getItem("hs_userId");
    const savedName = localStorage.getItem("hs_username");
    if (savedId && savedName) {
      setUserId(savedId);
      setUsername(savedName);
    }
    loadAssets().then(setAssets).catch(console.error);
  }, []);

  const handleAuth = useCallback(() => {
    const name = nameInput.trim();
    if (!name) return;
    const id = localStorage.getItem("hs_userId") || crypto.randomUUID();
    localStorage.setItem("hs_userId", id);
    localStorage.setItem("hs_username", name);
    setUserId(id);
    setUsername(name);
    setScreen("LOBBY");
  }, [nameInput]);

  const onEvent = useCallback((msg: string) => {
    setEventLog((prev) => [msg, ...prev].slice(0, 8));
  }, []);

  const handleSocketMessage = useCallback(
    (data: any) => {
      if (data.type === "SYNC_STATE" || data.type === "MATCH_START") {
        const state = data.payload as SerializedState;
        setGameState(state);
        if (data.type === "MATCH_START") {
          const me = state.players.find((p) => p.id === userId);
          if (me) localPosRef.current = { x: me.x, y: me.y };
          setScreen("GAME");
        }
      } else if (data.type === "HIT") {
        const { hit } = data.payload;
        onEvent(hit ? "Player neutralized!" : "Hunter missed!");
      } else if (data.type === "GAME_OVER") {
        const { winner, reason } = data.payload;
        onEvent(
          `Game Over: ${reason} — ${winner === "hunter" ? "Hunter" : "Animals"} win!`
        );
      }
    },
    [userId, onEvent]
  );

  const { send, connected } = useGameSocket(userId, username, handleSocketMessage);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!assets) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-xl">
        Loading assets...
      </div>
    );
  }

  if (screen === "AUTH") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-green-800 to-green-950 text-white gap-6">
        <h1 className="text-5xl font-bold tracking-tight">🦁 Herd &amp; Seek</h1>
        <p className="text-lg text-green-200 max-w-md text-center">
          An asymmetric stealth game. Blend in with the herd, or hunt them down.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Enter your username"
            className="px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:border-white"
            maxLength={20}
          />
          <button
            onClick={handleAuth}
            className="px-6 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition"
          >
            Play
          </button>
        </div>
      </div>
    );
  }

  if (screen === "LOBBY" && (!gameState || gameState.phase === "LOBBY")) {
    const me = gameState?.players.find((p) => p.id === userId);
    const isReady = me?.isReady ?? false;
    const playerCount = gameState?.players.length ?? 0;
    const allReady = gameState?.players.every((p) => p.isReady) ?? false;
    const canStart = playerCount >= 2 && allReady;

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-green-800 to-green-950 text-white gap-6 overflow-auto py-8">
        <h1 className="text-4xl font-bold">🦁 Herd &amp; Seek — Lobby</h1>
        <p className={`text-sm ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "● Connected" : "○ Connecting..."}
        </p>

        <div className="bg-black/30 rounded-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-semibold mb-3">
            Players ({playerCount})
          </h2>
          <div className="space-y-2">
            {gameState?.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2"
              >
                <span className="font-medium">
                  {ANIMAL_OPTIONS.find((a) => a.value === p.animalType)?.emoji}{" "}
                  {p.username}
                </span>
                <span
                  className={`text-sm ${
                    p.isReady ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {p.isReady ? "✓ Ready" : "..."}
                </span>
              </div>
            ))}
            {playerCount === 0 && (
              <p className="text-gray-400 text-sm">Waiting for connection...</p>
            )}
          </div>
          {playerCount < 2 && playerCount > 0 && (
            <p className="text-yellow-300 text-sm mt-3">
              Waiting for at least 2 players...
            </p>
          )}
        </div>

        <div className="bg-black/30 rounded-xl p-6 w-full max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Animal
            </label>
            <select
              value={selectedAnimal}
              onChange={(e) => {
                const val = e.target.value as AnimalType;
                setSelectedAnimal(val);
                send({ type: "SELECT_ANIMAL", payload: { animalType: val } });
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/30 text-white"
            >
              {ANIMAL_OPTIONS.map((a) => (
                <option key={a.value} value={a.value} className="bg-gray-800">
                  {a.emoji} {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Select Perk</label>
            <select
              value={selectedPerk}
              onChange={(e) => {
                const val = e.target.value as PerkType;
                setSelectedPerk(val);
                send({ type: "SELECT_PERK", payload: { perk: val } });
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/30 text-white"
            >
              {PERK_OPTIONS.map((p) => (
                <option key={p.value} value={p.value} className="bg-gray-800">
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-green-200 mt-1">
              {PERK_OPTIONS.find((p) => p.value === selectedPerk)?.description}
            </p>
          </div>

          <button
            onClick={() =>
              send({ type: "READY", payload: { isReady: !isReady } })
            }
            className={`w-full py-3 rounded-lg font-bold transition ${
              isReady
                ? "bg-green-500 hover:bg-green-400 text-black"
                : "bg-yellow-500 hover:bg-yellow-400 text-black"
            }`}
          >
            {isReady ? "✓ Ready — Click to Unready" : "Ready Up"}
          </button>

          {canStart && (
            <p className="text-center text-green-300 animate-pulse">
              Match starting...
            </p>
          )}
        </div>
      </div>
    );
  }

  const me = gameState?.players.find((p) => p.id === userId);
  const isHunter = me?.isHunter ?? false;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-green-900">
      <GameCanvas
        assets={assets}
        userId={userId}
        gameState={gameState}
        localPosRef={localPosRef}
        send={send}
      />

      {gameState?.phase === "PLAYING" && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white px-6 py-2 rounded-full text-2xl font-bold tabular-nums">
            ⏱ {formatTime(gameState.timeRemaining)}
          </div>

          <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg max-w-xs space-y-1">
            <h3 className="text-sm font-bold text-green-300">Event Log</h3>
            {eventLog.length === 0 && (
              <p className="text-xs text-gray-400">No events yet...</p>
            )}
            {eventLog.map((e, i) => (
              <p key={i} className="text-xs">
                {e}
              </p>
            ))}
          </div>

          {isHunter && (
            <div className="absolute bottom-4 right-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg">
              <h3 className="text-sm font-bold text-red-400 mb-1">Ammo</h3>
              <div className="flex gap-1 flex-wrap max-w-[120px]">
                {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-lg ${
                      i < gameState.ammo ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    🔫
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {gameState.ammo}/{gameState.maxAmmo}
              </p>
            </div>
          )}

          {!isHunter && me?.isAlive && (
            <div className="absolute bottom-4 right-4 z-10 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
              <p>
                Role: <span className="text-green-400">Animal</span>
              </p>
              <p className="text-xs text-gray-300">
                Survive! Shift/F for perks.
              </p>
            </div>
          )}

          {!me?.isAlive && !isHunter && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-black/80 text-white px-8 py-4 rounded-xl text-2xl font-bold">
              💀 You were neutralized!
            </div>
          )}
        </>
      )}

      {gameState?.phase === "ENDED" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 text-white rounded-2xl p-8 max-w-md text-center space-y-4">
            <h2 className="text-4xl font-bold">
              {gameState.winner === "hunter"
                ? "🎯 Hunter Wins!"
                : "🐾 Animals Win!"}
            </h2>
            <div className="space-y-1">
              {gameState.eventLog.map((e, i) => (
                <p key={i} className="text-sm text-gray-300">
                  {e}
                </p>
              ))}
            </div>
            <button
              onClick={() => {
                send({ type: "RESTART" });
                setScreen("LOBBY");
              }}
              className="px-6 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
