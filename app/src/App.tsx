import { useState, useEffect, useCallback, useRef } from "react";
import { loadAssetsForLevel, preloadAssetsForLevel, type AssetMap } from "./AssetLoader";
import GameCanvas from "./GameCanvas";
import HomeScreen from "./components/home/HomeScreen";
import ProfileBar from "./components/economy/ProfileBar";
import ShopModal from "./components/economy/ShopModal";
import AdminPanel from "./components/admin/AdminPanel";
import OpenWorldScreen from "./open-world/OpenWorldScreen";
import ModernLobby from "./components/lobby/ModernLobby";
import ModeSelect from "./components/ModeSelect";
import RoomBrowser from "./components/RoomBrowser";
import SoloSetup from "./components/SoloSetup";
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
  type ConnectionStatus,
  isAnimalAllowed,
  defaultAnimalForLevel,
} from "./types";
import { soundManager } from "./SoundManager";
import {
  generateRoomCode,
  soloRoomId,
  saveSession,
  clearSession,
  loadSession,
  type SessionRef,
} from "./room";

type AppRoute =
  | { type: "HOME" }
  | { type: "MODE_SELECT" }
  | { type: "ROOM_BROWSER" }
  | { type: "MATCH_LOBBY"; roomId: string }
  | { type: "MATCH_COUNTDOWN"; roomId: string }
  | { type: "MATCH_PLAYING"; roomId: string }
  | { type: "MATCH_RESULTS"; roomId: string }
  | { type: "SOLO_SETUP" }
  | { type: "SOLO_PLAYING"; roomId: string }
  | { type: "OPEN_WORLD"; zoneId: "savannahReserve" };

function readSavedSession() {
  if (typeof window === "undefined") return { userId: "", username: "" };
  return {
    userId: sessionStorage.getItem("hs_sessionId") ?? "",
    username: localStorage.getItem("hs_username") ?? "",
  };
}

function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export default function App() {
  const savedSession = readSavedSession();
  const initialSession = loadSession();
  const [userId, setUserId] = useState(savedSession.userId);
  const [username, setUsername] = useState(savedSession.username);
  const [session, setSession] = useState<SessionRef | null>(initialSession);
  const [route, setRoute] = useState<AppRoute>(
    savedSession.userId && savedSession.username
      ? initialSession
        ? initialSession.mode === "solo"
          ? { type: "SOLO_SETUP" }
          : { type: "MATCH_LOBBY", roomId: initialSession.roomId }
        : { type: "MODE_SELECT" }
      : { type: "HOME" }
  );

  const [assets, setAssets] = useState<AssetMap | null>(null);
  const [gameState, setGameState] = useState<SerializedState | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>("rabbit");
  const [selectedLevel, setSelectedLevel] = useState<LevelId>("forest");
  const [selectedPerk, setSelectedPerk] = useState<PerkType>("none");
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const viewport = useViewportInfo();
  const localPosRef = useRef({ x: 100, y: 100 });
  const fps = useFps();

  const { profile, setProfile, refresh: refreshProfile } = useProfile(userId, username);
  const [showShop, setShowShop] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [adminAuditLog, setAdminAuditLog] = useState<AdminAuditEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    loadAssetsForLevel("forest").then((next) => { if (!cancelled) setAssets(next); }).catch(console.error);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedLevel) preloadAssetsForLevel(selectedLevel);
  }, [selectedLevel]);

  const handleAuth = useCallback(() => {
    soundManager.unlock();
    const name = (document.getElementById("home-player-name") as HTMLInputElement | null)?.value?.trim();
    if (!name) return;
    const id = sessionStorage.getItem("hs_sessionId") || crypto.randomUUID();
    sessionStorage.setItem("hs_sessionId", id);
    localStorage.setItem("hs_username", name);
    setUserId(id);
    setUsername(name);
    setRoute({ type: "MODE_SELECT" });
  }, []);

  const onEvent = useCallback((msg: string) => {
    setEventLog((prev) => [msg, ...prev].slice(0, 8));
  }, []);

  const handleSocketMessage = useCallback(
    (data: ServerMessage) => {
      switch (data.type) {
        case "SYNC_STATE":
        case "MATCH_START": {
          const state = data.payload;
          if (isDebug()) (window as unknown as { __hsState?: SerializedState }).__hsState = state;
          setGameState(state);
          setSelectedLevel(state.levelId ?? "forest");
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
            setRoute({ type: "MATCH_PLAYING", roomId: session?.roomId ?? state.players[0]?.id ?? "" });
            setEndCountdown(null);
            break;
          }
          if (state.phase === "LOBBY" && route.type === "MATCH_PLAYING") {
            setRoute(session?.mode === "solo" ? { type: "SOLO_SETUP" } : { type: "MATCH_LOBBY", roomId: session?.roomId ?? "" });
            setEndCountdown(null);
          } else if (state.phase === "COUNTDOWN" || state.phase === "PLAYING") {
            if (route.type === "MATCH_LOBBY" || route.type === "SOLO_SETUP") setRoute({ type: "MATCH_COUNTDOWN", roomId: session?.roomId ?? "" });
          }
          break;
        }
        case "HIT": {
          const { hit, extraLife, animalType: newAnimalType, targetId, x, y } = data.payload;
          if (extraLife) {
            soundManager.perk();
            onEvent(`Extra Life! Respawned as ${newAnimalType}.`);
            if (targetId === userId) localPosRef.current = { x: x ?? localPosRef.current.x, y: y ?? localPosRef.current.y };
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
          setRoute({ type: "MATCH_PLAYING", roomId: session?.roomId ?? "" });
          setEndCountdown(5);
          void refreshProfile();
          break;
        }
        case "ADMIN_OK":
          setAdminAuthed(true); setAdminDenied(false); setAdminAuditLog(data.payload.auditLog ?? []); break;
        case "ADMIN_DENIED":
          setAdminAuthed(false); setAdminDenied(true); break;
        case "ADMIN_LOG":
          setAdminAuditLog(data.payload.auditLog ?? []); break;
      }
    },
    [userId, onEvent, route, session, refreshProfile]
  );

  // ── Socket: enabled only for match/solo contexts, keyed by explicit room ──
  const activeRoomId: string | null = (() => {
    if (!session) return null;
    if (session.mode === "multiplayer" && (route.type === "MATCH_LOBBY" || route.type === "MATCH_PLAYING" || route.type === "MATCH_COUNTDOWN" || route.type === "MATCH_RESULTS")) return session.roomId;
    if (session.mode === "solo" && (route.type === "SOLO_SETUP" || route.type === "SOLO_PLAYING" || route.type === "MATCH_COUNTDOWN" || route.type === "MATCH_PLAYING" || route.type === "MATCH_RESULTS")) return session.roomId;
    return null;
  })();
  const socketEnabled = activeRoomId !== null && !!userId && !!username;

  const { send } = useGameSocket({
    enabled: socketEnabled,
    roomId: activeRoomId,
    userId,
    username,
    onMessage: handleSocketMessage,
    onStatusChange: setStatus,
  });

  const handleAdminAuth = useCallback((key: string) => send({ type: "ADMIN_AUTH", payload: { adminKey: key } }), [send]);
  const handleAdminCommand = useCallback(
    (command: AdminCommand, extra?: { levelId?: LevelId; duration?: number; targetId?: string }) =>
      send({ type: "ADMIN_CMD", payload: { command, ...extra } }),
    [send]
  );

  const returnToLobby = useCallback(() => {
    send({ type: "RESTART" });
    setGameState(null);
    setRoute(session?.mode === "solo" ? { type: "SOLO_SETUP" } : { type: "MATCH_LOBBY", roomId: session?.roomId ?? "" });
    setEndCountdown(null);
  }, [send, session]);

  useEffect(() => {
    if (route.type !== "MATCH_PLAYING" && route.type !== "SOLO_PLAYING" || gameState?.phase !== "ENDED" || endCountdown === null) return;
    const interval = window.setInterval(() => {
      setEndCountdown((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endCountdown, gameState?.phase, route]);

  useEffect(() => {
    if ((route.type !== "MATCH_PLAYING" && route.type !== "SOLO_PLAYING") || gameState?.phase !== "ENDED" || endCountdown !== 0) return;
    const timeout = window.setTimeout(() => returnToLobby(), 0);
    return () => window.clearTimeout(timeout);
  }, [endCountdown, gameState?.phase, returnToLobby, route]);

  // ── Room / mode navigation ──
  const goCreateRoom = useCallback(() => {
    const code = generateRoomCode();
    const s: SessionRef = { roomId: code, mode: "multiplayer", hostUserId: userId, createdAt: Date.now() };
    saveSession(s); setSession(s); setRoute({ type: "MATCH_LOBBY", roomId: code });
  }, [userId]);
  const goJoinRoom = useCallback((code: string) => {
    const s: SessionRef = { roomId: code, mode: "multiplayer", hostUserId: "", createdAt: Date.now() };
    saveSession(s); setSession(s); setRoute({ type: "MATCH_LOBBY", roomId: code });
  }, []);
  const goSolo = useCallback(() => {
    const s: SessionRef = { roomId: soloRoomId(userId), mode: "solo", hostUserId: userId, createdAt: Date.now() };
    saveSession(s); setSession(s); setRoute({ type: "SOLO_SETUP" });
  }, [userId]);
  const startSolo = useCallback((role: "hunter" | "animal" | "random", botCount: number, level: LevelId) => {
    setSelectedLevel(level);
    send({ type: "SELECT_LEVEL", payload: { levelId: level } });
    send({ type: "START_SOLO", payload: { role, botCount } });
  }, [send]);
  const leaveRoom = useCallback(() => {
    send({ type: "LEAVE_ROOM" });
    clearSession(); setSession(null); setRoute({ type: "MODE_SELECT" });
  }, [send]);
  const closeRoom = useCallback(() => {
    send({ type: "CLOSE_ROOM" });
    clearSession(); setSession(null); setRoute({ type: "MODE_SELECT" });
  }, [send]);
  const goOpenWorld = useCallback(() => setRoute({ type: "OPEN_WORLD", zoneId: "savannahReserve" }), []);
  const exitOpenWorld = useCallback(() => setRoute({ type: "MODE_SELECT" }), []);

  const isHost = !!gameState && gameState.hostUserId === userId;

  if (route.type === "HOME") {
    return <HomeScreen nameInput={username} onNameChange={setUsername} onSubmit={handleAuth} />;
  }
  if (route.type === "MODE_SELECT") {
    return <ModeSelect onMultiplayer={() => setRoute({ type: "ROOM_BROWSER" })} onSolo={goSolo} onOpenWorld={goOpenWorld} />;
  }
  if (route.type === "ROOM_BROWSER") {
    return <RoomBrowser onCreate={goCreateRoom} onJoin={goJoinRoom} onBack={() => setRoute({ type: "MODE_SELECT" })} />;
  }
  if (route.type === "SOLO_SETUP") {
    return <SoloSetup onStart={startSolo} onBack={() => { clearSession(); setSession(null); setRoute({ type: "MODE_SELECT" }); }} />;
  }
  if (route.type === "OPEN_WORLD") {
    return <OpenWorldScreen userId={userId} username={username} animalType="zebra" onExit={exitOpenWorld} />;
  }

  if (route.type === "MATCH_LOBBY" && session?.mode === "multiplayer") {
    return (
      <>
        <ModernLobby
          username={username}
          userId={userId}
          gameState={gameState}
          connectionStatus={status}
          roomCode={session.roomId}
          isHost={isHost}
          level={profile?.level ?? 1}
          coins={profile?.coins ?? 0}
          mode={session.mode}
          selectedAnimal={selectedAnimal}
          selectedPerk={selectedPerk}
          selectedLevel={selectedLevel}
          onSelectAnimal={(a) => { setSelectedAnimal(a); send({ type: "SELECT_ANIMAL", payload: { animalType: a } }); }}
          onSelectPerk={(p) => { setSelectedPerk(p); send({ type: "SELECT_PERK", payload: { perk: p } }); }}
          onSelectLevel={(lvl) => {
            setSelectedLevel(lvl);
            setSelectedAnimal((prev) => (isAnimalAllowed(prev, lvl) ? prev : defaultAnimalForLevel(lvl)));
            send({ type: "SELECT_LEVEL", payload: { levelId: lvl } });
          }}
          onReady={() => send({ type: "READY" })}
          onCopyCode={() => {}}
          onLeave={leaveRoom}
          onCloseRoom={closeRoom}
          onOpenWorld={goOpenWorld}
        />
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-30">
          <ProfileBar profile={profile} onOpenShop={() => setShowShop(true)} />
        </div>
        {showShop && (
          <ShopModal userId={userId} username={username} profile={profile} onProfileChange={setProfile} onClose={() => setShowShop(false)} />
        )}
        <AdminPanel authed={adminAuthed} denied={adminDenied} auditLog={adminAuditLog} gameState={gameState}
          onAuth={handleAdminAuth} onCommand={handleAdminCommand} onClearDenied={() => setAdminDenied(false)} />
        {isDebug() && <Diagnostics route={route} roomId={session.roomId} status={status} userId={userId}
          playerCount={gameState?.players.length ?? 0} phase={gameState?.phase ?? "—"} fps={fps} />}
      </>
    );
  }

  // GAME (multiplayer + solo)
  const me = gameState?.players.find((p) => p.id === userId);
  const isHunter = me?.isHunter ?? false;
  const isPhoneLayout = viewport.layoutMode.startsWith("phone");
  const gameplayAssets = assets ?? ({} as AssetMap);
  const showCountdown = gameState?.phase === "COUNTDOWN";

  return (
    <div className="relative w-dvw h-dvh overflow-hidden bg-green-900" style={{ touchAction: "manipulation" }}>
      <GameCanvas assets={gameplayAssets} userId={userId} username={username} gameState={gameState} localPosRef={localPosRef} send={send} />

      {showCountdown && <CountdownOverlay endsAt={gameState?.countdownEndsAt ?? null} />}

      {gameState?.phase === "PLAYING" && (
        <>
          <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xl sm:text-2xl font-bold tabular-nums">
            ⏱ {formatTime(gameState.timeRemaining)}
          </div>
          {isPhoneLayout ? (
            <>
              <div className="absolute left-3 sm:left-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg max-w-[140px] sm:max-w-xs max-h-32 overflow-hidden space-y-1"
                style={{ bottom: "max(8.75rem, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}>
                <h3 className="text-xs sm:text-sm font-bold text-green-300">Events</h3>
                {eventLog.length === 0 && <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>}
                {eventLog.slice(0, 3).map((e, i) => <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>)}
              </div>
              {isHunter ? (
                <div className="absolute right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg"
                  style={{ bottom: "max(8.75rem, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}>
                  <h3 className="text-xs sm:text-sm font-bold text-red-400 mb-1">Ammo</h3>
                  <div className="flex gap-1 flex-wrap max-w-[100px] sm:max-w-[120px]">
                    {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                      <span key={i} className={`text-sm sm:text-lg ${i < gameState.ammo ? "opacity-100" : "opacity-20"}`}>🔫</span>
                    ))}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-300 mt-1">{gameState.ammo}/{gameState.maxAmmo}</p>
                </div>
              ) : (
                <div className="absolute right-3 sm:right-4 z-10 bg-black/70 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm"
                  style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
                  <p>Role: <span className="text-green-400">Animal</span></p>
                  <p className="text-[10px] sm:text-xs text-gray-300">Survive! Move to blend in.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <details className="absolute left-4 z-10 bg-black/70 text-white rounded-lg max-w-[280px] w-[clamp(220px,22vw,320px)]" style={{ top: "4.25rem" }} open>
                <summary className="cursor-pointer list-none px-4 py-2 text-xs sm:text-sm font-bold text-green-300 select-none">Events</summary>
                <div className="px-4 pb-3 space-y-1 max-h-40 overflow-hidden">
                  {eventLog.length === 0 && <p className="text-[10px] sm:text-xs text-gray-400">No events yet...</p>}
                  {eventLog.slice(0, 4).map((e, i) => <p key={i} className="text-[10px] sm:text-xs leading-tight">{e}</p>)}
                </div>
              </details>
              <div className="absolute right-4 z-10 bg-black/70 text-white px-4 py-3 rounded-lg" style={{ top: "4.25rem" }}>
                {isHunter ? (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-red-400 mb-1">Ammo</h3>
                    <div className="flex gap-1 flex-wrap max-w-[120px]">
                      {Array.from({ length: gameState.maxAmmo }).map((_, i) => (
                        <span key={i} className={`text-sm sm:text-lg ${i < gameState.ammo ? "opacity-100" : "opacity-20"}`}>🔫</span>
                      ))}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-300 mt-1">{gameState.ammo}/{gameState.maxAmmo}</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xs sm:text-sm font-bold text-green-300 mb-1">Role</h3>
                    <p><span className="text-green-400 font-bold">Animal</span></p>
                    <p className="text-[10px] sm:text-xs text-gray-300">Survive! Move to blend in.</p>
                  </>
                )}
              </div>
            </>
          )}
          {!me?.isAlive && !isHunter && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-black/80 text-white px-6 sm:px-8 py-4 rounded-xl text-xl sm:text-2xl font-bold text-center">
              💀 You were neutralized!
            </div>
          )}
        </>
      )}

      {gameState?.phase === "ENDED" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">
              {gameState.winner === "hunter" ? "🎯 Hunter Wins!" : "🐾 Animals Win!"}
            </h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gameState.eventLog.map((e, i) => <p key={i} className="text-sm text-gray-300">{e}</p>)}
            </div>
            <p className="text-sm text-gray-300">Returning to lobby {endCountdown !== null ? `in ${endCountdown}s` : "shortly"}...</p>
            <button onPointerDown={(e) => { e.preventDefault(); returnToLobby(); }}
              className="w-full px-6 py-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-bold text-base sm:text-lg transition min-h-[56px] touch-manipulation select-none">
              Return to Lobby Now
            </button>
          </div>
        </div>
      )}

      <AdminPanel authed={adminAuthed} denied={adminDenied} auditLog={adminAuditLog} gameState={gameState}
        onAuth={handleAdminAuth} onCommand={handleAdminCommand} onClearDenied={() => setAdminDenied(false)} />
      {isDebug() && session && <Diagnostics route={route} roomId={session.roomId} status={status} userId={userId}
        playerCount={gameState?.players.length ?? 0} phase={gameState?.phase ?? "—"} fps={fps} />}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has("debug");
}

function CountdownOverlay({ endsAt }: { endsAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  let label = "HIDE!";
  if (endsAt !== null) {
    const left = Math.ceil((endsAt - now) / 1000);
    label = left > 0 ? String(left) : "HIDE!";
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-none">
      <div className="text-white text-7xl sm:text-9xl font-extrabold drop-shadow-lg animate-pulse">{label}</div>
    </div>
  );
}

function Diagnostics({ route, roomId, status, userId, playerCount, phase, fps }: {
  route: AppRoute; roomId: string; status: ConnectionStatus; userId: string; playerCount: number; phase: string; fps: number;
}) {
  const suffix = userId.slice(-4);
  const routeLabel = route.type === "MATCH_LOBBY" || route.type === "MATCH_COUNTDOWN" || route.type === "MATCH_PLAYING" || route.type === "MATCH_RESULTS"
    ? `${route.type}:${route.roomId}`
    : route.type === "OPEN_WORLD"
      ? `${route.type}:${route.zoneId}`
      : route.type;
  return (
    <div className="fixed bottom-2 left-2 z-50 bg-black/80 text-green-300 text-[10px] font-mono p-2 rounded whitespace-pre leading-tight pointer-events-none">
      {`route: ${routeLabel}\nroom: ${roomId}\nphase: ${phase}\nsocket: ${status}\nuid: …${suffix}\nplayers: ${playerCount}\nfps: ${fps}`}
    </div>
  );
}
