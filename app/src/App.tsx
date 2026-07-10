import { useState, useEffect, useCallback, useRef } from "react";
import { loadAssetsForLevel, preloadAssetsForLevel, type AssetMap } from "./AssetLoader";
import GameCanvas from "./GameCanvas";
import LobbyScene from "./components/lobby/LobbyScene";
import HomeScreen from "./components/home/HomeScreen";
import ProfileBar from "./components/economy/ProfileBar";
import ShopModal from "./components/economy/ShopModal";
import AdminPanel from "./components/admin/AdminPanel";
import { useGameSocket } from "./useGameSocket";
import { useViewportInfo } from "./hooks/useViewportInfo";
import { useProfile } from "./hooks/useProfile";
import {
  type SerializedState,
  type AnimalType,
  type PerkType,
  type LevelId,
  type ServerMessage,
  type AdminAuditEntry,
  type AdminCommand,
  isAnimalAllowed,
  defaultAnimalForLevel,
} from "./types";
import { soundManager } from "./SoundManager";

type Screen = "AUTH" | "LOBBY" | "GAME";

function readSavedSession() {
  if (typeof window === "undefined") {
    return { userId: "", username: "" };
  }

  return {
    userId: sessionStorage.getItem("hs_sessionId") ?? "",
    username: localStorage.getItem("hs_username") ?? "",
  };
}

export default function App() {
  const savedSession = readSavedSession();
  const [screen, setScreen] = useState<Screen>(
    savedSession.userId && savedSession.username ? "LOBBY" : "AUTH"
  );
  const [userId, setUserId] = useState(savedSession.userId);
  const [username, setUsername] = useState(savedSession.username);
  const [nameInput, setNameInput] = useState(savedSession.username);
  const [assets, setAssets] = useState<AssetMap | null>(null);
  const [gameState, setGameState] = useState<SerializedState | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>("elephant");
  const [selectedLevel, setSelectedLevel] = useState<LevelId>("forest");
  const [selectedPerk, setSelectedPerk] = useState<PerkType>("none");
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const viewport = useViewportInfo();
  const localPosRef = useRef({ x: 100, y: 100 });

  // Economy / persistence.
  const { profile, setProfile, refresh: refreshProfile } = useProfile(userId, username);
  const [showShop, setShowShop] = useState(false);

  // Admin control plane.
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [adminAuditLog, setAdminAuditLog] = useState<AdminAuditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAssetsForLevel("forest")
      .then((next) => {
        if (!cancelled) setAssets(next);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  // Background-load the selected level's biome assets ahead of match start so
  // switching maps never stalls on art (procedural biomes are no-ops).
  useEffect(() => {
    if (selectedLevel === "forest" || selectedLevel === "deepDark" || selectedLevel === "savannah") {
      preloadAssetsForLevel(selectedLevel);
    }
  }, [selectedLevel]);

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
    (data: ServerMessage) => {
      switch (data.type) {
        case "SYNC_STATE":
        case "MATCH_START": {
          const state = data.payload;
          setGameState(state);
          setSelectedLevel(state.levelId ?? "forest");

          // Reconcile local morph selection with the authoritative server state.
          // Server corrects invalid morphs on SELECT_LEVEL, so trust it here.
          const me = state.players.find((p) => p.id === userId);
          if (me) {
            setSelectedAnimal((prev) => {
              const lvl = state.levelId ?? "forest";
              if (!isAnimalAllowed(prev, lvl)) return me.animalType;
              return prev === me.animalType ? prev : me.animalType;
            });
          }

          if (data.type === "MATCH_START") {
            const meLocal = state.players.find((p) => p.id === userId);
            if (meLocal) localPosRef.current = { x: meLocal.x, y: meLocal.y };
            setScreen("GAME");
            setEndCountdown(null);
            break;
          }

          if (state.phase === "LOBBY" && screen === "GAME") {
            setScreen("LOBBY");
            setEndCountdown(null);
          }
          break;
        }
        case "HIT": {
          const { hit, extraLife, animalType: newAnimalType, targetId, x, y } = data.payload;
          if (extraLife) {
            soundManager.perk();
            onEvent(`Extra Life! Respawned as ${newAnimalType}.`);
            if (targetId === userId) {
              localPosRef.current = {
                x: x ?? localPosRef.current.x,
                y: y ?? localPosRef.current.y,
              };
            }
          } else if (hit) {
            soundManager.hit();
            onEvent("Player neutralized!");
          } else {
            soundManager.miss();
            onEvent("Hunter missed!");
          }
          break;
        }
        case "GAME_OVER": {
          const { reason, state } = data.payload;
          setGameState(state);
          setSelectedLevel(state.levelId ?? "forest");
          soundManager.gameEnd();
          onEvent(`Game Over: ${reason}`);
          setScreen("GAME");
          setEndCountdown(5);
          // Match rewards were just persisted server-side — pull the fresh wallet.
          void refreshProfile();
          break;
        }
        case "ADMIN_OK": {
          setAdminAuthed(true);
          setAdminDenied(false);
          setAdminAuditLog(data.payload.auditLog ?? []);
          break;
        }
        case "ADMIN_DENIED": {
          setAdminAuthed(false);
          setAdminDenied(true);
          break;
        }
        case "ADMIN_LOG": {
          setAdminAuditLog(data.payload.auditLog ?? []);
          break;
        }
      }
    },
    [userId, onEvent, screen, refreshProfile]
  );

  const { send, connected } = useGameSocket(userId, username, handleSocketMessage);

  const handleAdminAuth = useCallback(
    (key: string) => {
      send({ type: "ADMIN_AUTH", payload: { adminKey: key } });
    },
    [send]
  );

  const handleAdminCommand = useCallback(
    (
      command: AdminCommand,
      extra?: { levelId?: LevelId; duration?: number; targetId?: string }
    ) => {
      send({ type: "ADMIN_CMD", payload: { command, ...extra } });
    },
    [send]
  );

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
    if (screen !== "GAME" || gameState?.phase !== "ENDED" || endCountdown === null) return;

    const interval = window.setInterval(() => {
      setEndCountdown((prev) => {
        if (prev === null) return null;
        return Math.max(0, prev - 1);
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [endCountdown, gameState?.phase, screen]);

  useEffect(() => {
    if (screen !== "GAME" || gameState?.phase !== "ENDED" || endCountdown !== 0) return;

    const timeout = window.setTimeout(() => {
      returnToLobby();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [endCountdown, gameState?.phase, returnToLobby, screen]);

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
    return (
      <>
        <LobbyScene
          username={username}
          userId={userId}
          gameState={gameState}
          connected={connected}
          selectedAnimal={selectedAnimal}
          selectedPerk={selectedPerk}
          selectedLevel={selectedLevel}
          onSelectAnimal={(a) => {
            setSelectedAnimal(a);
            send({ type: "SELECT_ANIMAL", payload: { animalType: a } });
          }}
          onSelectPerk={(p) => {
            setSelectedPerk(p);
            send({ type: "SELECT_PERK", payload: { perk: p } });
          }}
          onSelectLevel={(lvl) => {
            setSelectedLevel(lvl);
            // Optimistically fix our morph so the panel updates instantly; the
            // server also enforces this and re-syncs authoritative state.
            setSelectedAnimal((prev) => (isAnimalAllowed(prev, lvl) ? prev : defaultAnimalForLevel(lvl)));
            send({ type: "SELECT_LEVEL", payload: { levelId: lvl } });
          }}
          onSetDuration={(seconds) => {
            send({ type: "SET_DURATION", payload: { duration: seconds } });
          }}
          onReady={() => {
            send({ type: "READY" });
          }}
          onStartSolo={() => {
            // No role specified — server randomly assigns hunter or animal
            send({ type: "START_SOLO", payload: {} });
          }}
          onSoloWithBots={(role, botCount) => {
            send({ type: "START_SOLO", payload: { role, botCount } });
          }}
        />

        {/* Wallet pill (top-center overlay) */}
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-30">
          <ProfileBar profile={profile} onOpenShop={() => setShowShop(true)} />
        </div>

        {showShop && (
          <ShopModal
            userId={userId}
            username={username}
            profile={profile}
            onProfileChange={setProfile}
            onClose={() => setShowShop(false)}
          />
        )}

        <AdminPanel
          authed={adminAuthed}
          denied={adminDenied}
          auditLog={adminAuditLog}
          gameState={gameState}
          onAuth={handleAdminAuth}
          onCommand={handleAdminCommand}
          onClearDenied={() => setAdminDenied(false)}
        />
      </>
    );
  }

  const me = gameState?.players.find((p) => p.id === userId);
  const isHunter = me?.isHunter ?? false;
  const isPhoneLayout = viewport.layoutMode.startsWith("phone");
  const gameplayAssets = assets ?? ({} as AssetMap);

  return (
    <div
      className="relative w-dvw h-dvh overflow-hidden bg-green-900"
      style={{ touchAction: "manipulation" }}
    >
      <GameCanvas
         assets={gameplayAssets}
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

          {isPhoneLayout ? (
            <>
              <div
                className="absolute left-3 sm:left-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg max-w-[140px] sm:max-w-xs max-h-32 overflow-hidden space-y-1"
                style={{
                  bottom: "max(8.75rem, calc(env(safe-area-inset-bottom, 0px) + 16px))",
                }}
              >
                <h3 className="text-xs sm:text-sm font-bold text-green-300">Events</h3>
                {eventLog.length === 0 && (
                  <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>
                )}
                {eventLog.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>
                ))}
              </div>

              {isHunter ? (
                <div
                  className="absolute right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg"
                  style={{
                    bottom: "max(8.75rem, calc(env(safe-area-inset-bottom, 0px) + 16px))",
                  }}
                >
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
              ) : (
                <div
                  className="absolute right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm"
                  style={{
                    bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 12px))",
                  }}
                >
                  <p>
                    Role: <span className="text-green-400">Animal</span>
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-300">
                    Survive! Move to blend in.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <details
                className="absolute left-4 z-10 bg-black/70 text-white rounded-lg max-w-[280px] w-[clamp(220px,22vw,320px)]"
                style={{ top: "4.25rem" }}
                open
              >
                <summary className="cursor-pointer list-none px-4 py-2 text-xs sm:text-sm font-bold text-green-300 select-none">
                  Events
                </summary>
                <div className="px-4 pb-3 space-y-1 max-h-40 overflow-hidden">
                  {eventLog.length === 0 && (
                    <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>
                  )}
                  {eventLog.slice(0, 4).map((e, i) => (
                    <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>
                  ))}
                </div>
              </details>

              <div
                className="absolute right-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg"
                style={{ top: "4.25rem" }}
              >
                {isHunter ? (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-red-400 mb-1">Ammo</h3>
                    <div className="flex gap-1 flex-wrap max-w-[120px]">
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
                  </>
                ) : (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-green-300 mb-1">Role</h3>
                    <p>
                      <span className="text-green-400 font-bold">Animal</span>
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-300">
                      Survive! Move to blend in.
                    </p>
                  </>
                )}
              </div>
            </>
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

      <AdminPanel
        authed={adminAuthed}
        denied={adminDenied}
        auditLog={adminAuditLog}
        gameState={gameState}
        onAuth={handleAdminAuth}
        onCommand={handleAdminCommand}
        onClearDenied={() => setAdminDenied(false)}
      />
    </div>
  );
}
