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
import { soundManager } from "./SoundManager";

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
    const savedId = sessionStorage.getItem("hs_sessionId");
    const savedName = localStorage.getItem("hs_username");
    if (savedId && savedName) {
      setUserId(savedId);
      setUsername(savedName);
      setNameInput(savedName);
    }
    loadAssets().then(setAssets).catch(console.error);
  }, []);

  const handleAuth = useCallback(() => {
    const name = nameInput.trim();
    if (!name) return;
    const id = sessionStorage.getItem("hs_sessionId") || crypto.randomUUID();
    sessionStorage.setItem("hs_sessionId", id);
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
        if (hit) {
          soundManager.hit();
          onEvent("Player neutralized!");
        } else {
          soundManager.miss();
          onEvent("Hunter missed!");
        }
      } else if (data.type === "GAME_OVER") {
        const { winner, reason } = data.payload;
        soundManager.gameEnd();
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
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-xl sm:text-2xl">
        Loading assets...
      </div>
    );
  }

  if (screen === "AUTH") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-green-800 to-green-950 text-white gap-6 sm:gap-8 px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center">
          🦁 Herd &amp; Seek
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-green-200 max-w-md text-center">
          An asymmetric stealth game. Blend in with the herd, or hunt them down.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Enter your username"
            className="flex-1 px-4 py-4 sm:py-3 rounded-lg bg-white/10 border border-white/30 text-white text-lg sm:text-base placeholder-white/50 focus:outline-none focus:border-white min-h-[56px]"
            maxLength={20}
            autoComplete="off"
          />
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleAuth();
            }}
            className="px-8 py-4 sm:py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold text-lg sm:text-base transition min-h-[56px] touch-manipulation select-none"
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-800 to-green-950 text-white gap-4 sm:gap-6 overflow-auto py-6 px-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center">
          🦁 Herd &amp; Seek
        </h1>
        <p className={`text-sm sm:text-base ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "● Connected" : "○ Connecting..."}
        </p>

        <div className="bg-black/30 rounded-xl p-4 sm:p-6 w-full max-w-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">
            Players ({playerCount})
          </h2>
          <div className="space-y-2">
            {gameState?.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-3 sm:py-2"
              >
                <span className="font-medium text-sm sm:text-base">
                  🐾 {p.username}
                </span>
                <span
                  className={`text-sm ${p.isReady ? "text-green-400" : "text-gray-400"}`}
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

        <div className="bg-black/30 rounded-xl p-4 sm:p-6 w-full max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Animal</label>
            <select
              value={selectedAnimal}
              onChange={(e) => {
                const val = e.target.value as AnimalType;
                setSelectedAnimal(val);
                send({ type: "SELECT_ANIMAL", payload: { animalType: val } });
              }}
              className="w-full px-3 py-3 sm:py-2 rounded-lg bg-white/10 border border-white/30 text-white text-base min-h-[48px]"
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
              className="w-full px-3 py-3 sm:py-2 rounded-lg bg-white/10 border border-white/30 text-white text-base min-h-[48px]"
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
            onPointerDown={(e) => {
              e.preventDefault();
              send({ type: "READY", payload: { isReady: !isReady } });
            }}
            className={`w-full py-4 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition min-h-[56px] touch-manipulation select-none ${
              isReady
                ? "bg-green-500 hover:bg-green-400 active:bg-green-600 text-black"
                : "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black"
            }`}
          >
            {isReady ? "✓ Ready — Tap to Unready" : "Ready Up"}
          </button>

          {canStart && (
            <p className="text-center text-green-300 animate-pulse text-sm sm:text-base">
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
    <div
      className="relative w-screen h-screen overflow-hidden bg-green-900"
      style={{ touchAction: "none" }}
    >
      <GameCanvas
        assets={assets}
        userId={userId}
        gameState={gameState}
        localPosRef={localPosRef}
        send={send}
      />

      {gameState?.phase === "PLAYING" && (
        <>
          {/* Top Timer - responsive, scales down on mobile */}
          <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xl sm:text-2xl font-bold tabular-nums">
            ⏱ {formatTime(gameState.timeRemaining)}
          </div>

          {/* Event Log - bottom left, smaller on mobile, collapsible */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg max-w-[160px] sm:max-w-xs space-y-1">
            <h3 className="text-xs sm:text-sm font-bold text-green-300">Events</h3>
            {eventLog.length === 0 && (
              <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>
            )}
            {eventLog.slice(0, 4).map((e, i) => (
              <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>
            ))}
          </div>

          {/* Hunter Ammo - bottom right, responsive */}
          {isHunter && (
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
              <h3 className="text-xs sm:text-sm font-bold text-red-400 mb-1">Ammo</h3>
              <div className="flex gap-1 flex-wrap max-w-[100px] sm:max-w-[120px]">
                {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-sm sm:text-lg ${i < gameState.ammo ? "opacity-100" : "opacity-20"}`}
                  >
                    🔫
                  </span>
                ))}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-300 mt-1">
                {gameState.ammo}/{gameState.maxAmmo}
              </p>
            </div>
          )}

          {/* Animal role indicator - bottom right, responsive */}
          {!isHunter && me?.isAlive && (
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm">
              <p>
                Role: <span className="text-green-400">Animal</span>
              </p>
              <p className="text-[10px] sm:text-xs text-gray-300">
                Survive! Move to blend in.
              </p>
            </div>
          )}

          {/* Neutralized overlay */}
          {!me?.isAlive && !isHunter && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-black/80 text-white px-6 sm:px-8 py-4 rounded-xl text-xl sm:text-2xl font-bold text-center">
              💀 You were neutralized!
            </div>
          )}
        </>
      )}

      {/* End Game Screen - responsive */}
      {gameState?.phase === "ENDED" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              {gameState.winner === "hunter" ? "🎯 Hunter Wins!" : "🐾 Animals Win!"}
            </h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gameState.eventLog.map((e, i) => (
                <p key={i} className="text-sm text-gray-300">{e}</p>
              ))}
            </div>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                send({ type: "RESTART" });
                setScreen("LOBBY");
              }}
              className="w-full px-6 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold text-base sm:text-lg transition min-h-[56px] touch-manipulation select-none"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
