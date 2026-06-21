import { useState, useEffect, useCallback, useRef } from "react";
import { loadAssets, type AssetMap } from "./AssetLoader";
import GameCanvas from "./GameCanvas";
import LobbyScene from "./components/lobby/LobbyScene";
import HomeScreen from "./components/home/HomeScreen";
import { useGameSocket } from "./useGameSocket";
import {
  type SerializedState,
  type AnimalType,
  type PerkType,
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
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
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
    soundManager.unlock();
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
        const { hit, extraLife, animalType: newAnimalType, targetId, x, y } = data.payload;
        if (hit) {
          soundManager.hit();
          onEvent("Player neutralized!");
        } else if (extraLife) {
          soundManager.perk();
          onEvent(`Extra Life! Respawned as ${newAnimalType}.`);
          if (targetId === userId && gameState) {
            localPosRef.current = { x: x ?? localPosRef.current.x, y: y ?? localPosRef.current.y };
          }
        } else {
          soundManager.miss();
          onEvent("Hunter missed!");
        }
      } else if (data.type === "GAME_OVER") {
        const { winner, reason, state } = data.payload;
        if (state) setGameState(state);
        soundManager.gameEnd();
        onEvent(
          `Game Over: ${reason} — ${winner === "hunter" ? "Hunter" : "Animals"} win!`
        );
        // Ensure all players (including eliminated) see the end screen
        setScreen("GAME");
      }
    },
    [userId, onEvent]
  );

  const { send, connected } = useGameSocket(userId, username, handleSocketMessage);

  const returnToLobby = useCallback(() => {
    send({ type: "RESTART" });
    setGameState(null);
    setScreen("LOBBY");
    setEndCountdown(null);
  }, [send]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (screen !== "GAME" || gameState?.phase !== "ENDED") {
      setEndCountdown(null);
      return;
    }
    setEndCountdown(5);
    const interval = window.setInterval(() => {
      setEndCountdown((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState?.phase, screen]);

  useEffect(() => {
    if (endCountdown !== 0) return;
    returnToLobby();
  }, [endCountdown, returnToLobby]);

  // Handle server-initiated return to lobby (server resets room after 5s countdown)
  useEffect(() => {
    if (gameState?.phase === "LOBBY" && screen === "GAME") {
      setGameState(null);
      setScreen("LOBBY");
      setEndCountdown(null);
    }
  }, [gameState?.phase, screen]);

  if (!assets) {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-900 text-white text-xl sm:text-2xl">
        Loading assets...
      </div>
    );
  }

  if (screen === "AUTH") {
    return (
      <HomeScreen
        nameInput={nameInput}
        onNameChange={setNameInput}
        onSubmit={handleAuth}
      />
    );
  }

  if (screen === "LOBBY" && (!gameState || gameState.phase === "LOBBY")) {
    const me = gameState?.players.find((p) => p.id === userId);
    const isReady = me?.isReady ?? false;

    return (
      <LobbyScene
        username={username}
        userId={userId}
        gameState={gameState}
        connected={connected}
        selectedAnimal={selectedAnimal}
        selectedPerk={selectedPerk}
        onSelectAnimal={(a) => {
          setSelectedAnimal(a);
          send({ type: "SELECT_ANIMAL", payload: { animalType: a } });
        }}
        onSelectPerk={(p) => {
          setSelectedPerk(p);
          send({ type: "SELECT_PERK", payload: { perk: p } });
        }}
        onSetDuration={(seconds) => {
          send({ type: "SET_DURATION", payload: { duration: seconds } });
        }}
        onReady={() => {
          send({ type: "READY", payload: { isReady: !isReady } });
        }}
        onStart={() => {
          // Match starts automatically when all ready — no explicit start needed
        }}
        onStartSolo={(role) => {
          send({ type: "START_SOLO", payload: { role } });
        }}
      />
    );
  }

  const me = gameState?.players.find((p) => p.id === userId);
  const isHunter = me?.isHunter ?? false;

  return (
    <div
      className="relative w-dvw h-dvh overflow-hidden bg-green-900"
      style={{ touchAction: "none" }}
    >
<GameCanvas
         assets={assets}
         userId={userId}
         username={username}
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

{/* Event Log - bottom left, smaller on mobile */}
           <div className="absolute bottom-44 sm:bottom-4 left-3 sm:left-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg max-w-[140px] sm:max-w-xs max-h-32 overflow-hidden space-y-1">
             <h3 className="text-xs sm:text-sm font-bold text-green-300">Events</h3>
             {eventLog.length === 0 && (
               <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>
             )}
             {eventLog.slice(0, 3).map((e, i) => (
               <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>
             ))}
           </div>

           {/* Hunter Ammo - bottom right, responsive, positioned above fire button */}
           {isHunter && (
             <div className="absolute bottom-44 sm:bottom-4 right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
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

{/* Animal role indicator - bottom right, positioned below perk button on mobile */}
            {!isHunter && me?.isAlive && (
              <div className="absolute bottom-24 sm:bottom-4 right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm">
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
            <p className="text-sm text-gray-300">
              Returning to lobby {endCountdown !== null ? `in ${endCountdown}s` : "shortly"}...
            </p>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                returnToLobby();
              }}
              className="w-full px-6 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold text-base sm:text-lg transition min-h-[56px] touch-manipulation select-none"
            >
              Return to Lobby Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
