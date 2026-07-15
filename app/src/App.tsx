import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { loadAssetsForLevel, preloadAssetsForLevel, type AssetMap } from "./AssetLoader";
import GameCanvas from "./GameCanvas";
import { resolveRendererMode } from "./game-engine/rendererMode";
import GameHud from "./game-engine/GameHud";
import HomeScreen from "./components/home/HomeScreen";
import ShopModal from "./components/economy/ShopModal";
import AdminPanel from "./components/admin/AdminPanel";
import OpenWorldScreen from "./open-world/OpenWorldScreen";
import ModernLobby from "./components/lobby/ModernLobby";
import ModeSelect from "./components/ModeSelect";
import RoomBrowser from "./components/RoomBrowser";
import SoloSetup from "./components/SoloSetup";
import SoccerSetup, { type SoccerSetupSelection } from "./components/SoccerSetup";
import { useGameSocket } from "./useGameSocket";
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
  type SoloDifficulty,
  type DecoySpawnPayload,
  isAnimalAllowed,
  defaultAnimalForLevel,
} from "./types";
import { soundManager } from "./SoundManager";
import {
  soloRoomId,
  saveSession,
  clearSession,
  loadSession,
  type SessionRef,
} from "./room";

type AppRoute =
  | { type: "HOME" }
  | { type: "MODE_SELECT" }
  | { type: "ROOM_BROWSER"; activity: "hunt" | "soccer" }
  | { type: "MATCH_LOBBY"; roomId: string }
  | { type: "MATCH_COUNTDOWN"; roomId: string }
  | { type: "MATCH_PLAYING"; roomId: string }
  | { type: "MATCH_RESULTS"; roomId: string }
  | { type: "SOLO_SETUP" }
  | { type: "SOLO_PLAYING"; roomId: string }
  | { type: "OPEN_WORLD"; zoneId: "savannahReserve" }
  | { type: "SOCCER_SETUP" }
  | { type: "SOCCER_PLAYING"; network?: { roomId: string; accessToken?: string } };

const GAME_RENDERER = resolveRendererMode(import.meta.env.VITE_GAME_RENDERER);
const PhaserGame = lazy(() => import("./game-engine/PhaserGame"));
const SoccerGame = lazy(() => import("./components/SoccerGame"));

function readSavedSession() {
  if (typeof window === "undefined") return { userId: "", username: "" };
  return {
    userId: sessionStorage.getItem("hs_sessionId") ?? "",
    username: localStorage.getItem("hs_username") ?? "",
  };
}

function useFps(enabled: boolean): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);
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
  const [soccerSelection, setSoccerSelection] = useState<SoccerSetupSelection>({ team: "coral", format: "quick", teamSize: 5 });
  const [endCountdown, setEndCountdown] = useState<number | null>(null);
  const [decoySpawn, setDecoySpawn] = useState<(DecoySpawnPayload & { receivedAt: number }) | null>(null);
  const localPosRef = useRef({ x: 100, y: 100 });
  const debugMode = isDebug();
  const fps = useFps(debugMode);

  useEffect(() => {
    void soundManager.startMusic(route.type.startsWith("SOCCER") ? "soccer" : "reserve");
  }, [route.type]);

  const { profile, setProfile, refresh: refreshProfile } = useProfile(userId, username);
  const [showShop, setShowShop] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [adminAuditLog, setAdminAuditLog] = useState<AdminAuditEntry[]>([]);
  const [adminRevealSignal, setAdminRevealSignal] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const pendingSoloStartRef = useRef<{ role: "hunter" | "animal" | "random"; botCount: number; level: LevelId; animal: AnimalType; perk: PerkType; duration: number; difficulty: SoloDifficulty } | null>(null);

  useEffect(() => {
    if (!navigator.userAgent.toLowerCase().includes("jsdom")) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector<HTMLElement>(".mode-camp, .solo-camp")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [route.type]);

  useEffect(() => {
    let cancelled = false;
    loadAssetsForLevel("forest").then((next) => { if (!cancelled) setAssets(next); }).catch(console.error);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedLevel) preloadAssetsForLevel(selectedLevel);
  }, [selectedLevel]);

  const handleAuth = useCallback((submittedName?: string) => {
    soundManager.unlock();
    const name = (submittedName ?? username).trim();
    if (!name) return;
    const id = sessionStorage.getItem("hs_sessionId") || crypto.randomUUID();
    sessionStorage.setItem("hs_sessionId", id);
    localStorage.setItem("hs_username", name);
    setUserId(id);
    setUsername(name);
    setRoute({ type: "MODE_SELECT" });
  }, [username]);

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
            setSelectedPerk(me.perk);
            setSelectedAnimal((prev) => {
              const lvl = state.levelId ?? "forest";
              if (!isAnimalAllowed(prev, lvl)) return me.animalType;
              return prev === me.animalType ? prev : me.animalType;
            });
          }
          if (data.type === "MATCH_START") {
            soundManager.gameStart();
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
        case "DECOY_SPAWN":
          setDecoySpawn({ ...data.payload, receivedAt: Date.now() });
          break;
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
    accessToken: session?.accessToken,
    onMessage: handleSocketMessage,
    onStatusChange: setStatus,
  });

  const handleAdminAuth = useCallback((key: string) => send({ type: "ADMIN_AUTH", payload: { adminKey: key } }), [send]);
  const handleAdminLogout = useCallback(() => {
    send({ type: "ADMIN_LOGOUT" });
    setAdminAuthed(false);
    setAdminDenied(false);
    setAdminAuditLog([]);
  }, [send]);
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
  const goCreateRoom = useCallback((code: string, accessToken?: string) => {
    if (route.type === "ROOM_BROWSER" && route.activity === "soccer") {
      clearSession(); setSession(null); setRoute({ type: "SOCCER_PLAYING", network: { roomId: code, ...(accessToken ? { accessToken } : {}) } });
      return;
    }
    const s: SessionRef = { roomId: code, mode: "multiplayer", hostUserId: userId, createdAt: Date.now(), ...(accessToken ? { accessToken } : {}) };
    saveSession(s); setSession(s); setRoute({ type: "MATCH_LOBBY", roomId: code });
  }, [route, userId]);
  const goJoinRoom = useCallback((code: string, accessToken?: string) => {
    if (route.type === "ROOM_BROWSER" && route.activity === "soccer") {
      clearSession(); setSession(null); setRoute({ type: "SOCCER_PLAYING", network: { roomId: code, ...(accessToken ? { accessToken } : {}) } });
      return;
    }
    const s: SessionRef = { roomId: code, mode: "multiplayer", hostUserId: "", createdAt: Date.now(), ...(accessToken ? { accessToken } : {}) };
    saveSession(s); setSession(s); setRoute({ type: "MATCH_LOBBY", roomId: code });
  }, [route]);
  const goSolo = useCallback(() => {
    const s: SessionRef = { roomId: soloRoomId(userId), mode: "solo", hostUserId: userId, createdAt: Date.now() };
    saveSession(s); setSession(s); setRoute({ type: "SOLO_SETUP" });
  }, [userId]);
  const startSolo = useCallback((settings: { role: "hunter" | "animal" | "random"; botCount: number; level: LevelId; animal: AnimalType; perk: PerkType; duration: number; difficulty: SoloDifficulty }) => {
    const { role, botCount, level, animal, perk, duration, difficulty } = settings;
    setSelectedLevel(level); setSelectedAnimal(animal); setSelectedPerk(perk);
    if (status === "connected") {
      send({ type: "SELECT_LEVEL", payload: { levelId: level } });
      send({ type: "SELECT_ANIMAL", payload: { animalType: animal } });
      send({ type: "SELECT_PERK", payload: { perk } });
      send({ type: "SET_DURATION", payload: { duration } });
      send({ type: "START_SOLO", payload: { role, botCount, difficulty } });
    } else {
      pendingSoloStartRef.current = settings;
    }
  }, [send, status]);

  useEffect(() => {
    if (status !== "connected" || !pendingSoloStartRef.current) return;
    const pending = pendingSoloStartRef.current;
    pendingSoloStartRef.current = null;
    send({ type: "SELECT_LEVEL", payload: { levelId: pending.level } });
    send({ type: "SELECT_ANIMAL", payload: { animalType: pending.animal } });
    send({ type: "SELECT_PERK", payload: { perk: pending.perk } });
    send({ type: "SET_DURATION", payload: { duration: pending.duration } });
    send({ type: "START_SOLO", payload: { role: pending.role, botCount: pending.botCount, difficulty: pending.difficulty } });
  }, [send, status]);
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
  const startSoccer = useCallback((selection: SoccerSetupSelection) => {
    setSoccerSelection(selection);
    setRoute(selection.format === "crew" ? { type: "ROOM_BROWSER", activity: "soccer" } : { type: "SOCCER_PLAYING" });
  }, []);

  const isHost = !!gameState && gameState.hostUserId === userId;

  if (route.type === "HOME") {
    return <HomeScreen nameInput={username} onNameChange={setUsername} onSubmit={handleAuth} />;
  }
  if (route.type === "MODE_SELECT") {
    return <ModeSelect onMultiplayer={() => setRoute({ type: "ROOM_BROWSER", activity: "hunt" })} onSolo={goSolo} onOpenWorld={goOpenWorld} onSoccer={() => setRoute({ type: "SOCCER_SETUP" })} />;
  }
  if (route.type === "ROOM_BROWSER") {
    return <RoomBrowser activity={route.activity} defaultMaxPlayers={route.activity === "soccer" ? soccerSelection.teamSize * 2 : 8} onCreate={goCreateRoom} onJoin={goJoinRoom} onBack={() => setRoute(route.activity === "soccer" ? { type: "SOCCER_SETUP" } : { type: "MODE_SELECT" })} />;
  }
  if (route.type === "SOLO_SETUP") {
    return <SoloSetup onStart={startSolo} onBack={() => { clearSession(); setSession(null); setRoute({ type: "MODE_SELECT" }); }} />;
  }
  if (route.type === "OPEN_WORLD") {
    return <OpenWorldScreen userId={userId} username={username} animalType="zebra" onExit={exitOpenWorld} />;
  }
  if (route.type === "SOCCER_SETUP") {
    return <SoccerSetup playerName={username} onStart={startSoccer} onBack={() => setRoute({ type: "MODE_SELECT" })} />;
  }
  if (route.type === "SOCCER_PLAYING") {
    return <Suspense fallback={<div className="absolute inset-0 grid place-items-center bg-[#498099] text-[#fff5de] font-bold">Marking the pitch…</div>}><SoccerGame userId={userId} username={username} selection={soccerSelection} network={route.network} onExit={() => setRoute({ type: "SOCCER_SETUP" })} /></Suspense>;
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
          onSetDuration={(duration) => send({ type: "SET_DURATION", payload: { duration } })}
          onReady={(isReady) => send({ type: "READY", payload: { isReady } })}
          onCopyCode={() => {}}
          onLeave={leaveRoom}
          onCloseRoom={closeRoom}
          onOpenWorld={goOpenWorld}
          onOpenShop={() => setShowShop(true)}
          onOpenAdmin={() => setAdminRevealSignal((value) => value + 1)}
        />
        {showShop && (
          <ShopModal userId={userId} username={username} profile={profile} onProfileChange={setProfile} onClose={() => setShowShop(false)} />
        )}
        <AdminPanel key={adminRevealSignal} authed={adminAuthed} denied={adminDenied} auditLog={adminAuditLog} gameState={gameState}
          onAuth={handleAdminAuth} onCommand={handleAdminCommand} onClearDenied={() => setAdminDenied(false)} onLogout={handleAdminLogout} revealSignal={adminRevealSignal} />
        {debugMode && <Diagnostics route={route} roomId={session.roomId} status={status} userId={userId}
          playerCount={gameState?.players.length ?? 0} phase={gameState?.phase ?? "—"} fps={fps} />}
      </>
    );
  }

  // GAME (multiplayer + solo)
  const me = gameState?.players.find((p) => p.id === userId);
  const isHunter = me?.isHunter ?? false;
  const gameplayAssets = assets ?? ({} as AssetMap);
  const showCountdown = gameState?.phase === "COUNTDOWN";

  return (
    <div className="relative w-dvw h-dvh overflow-hidden bg-green-900" style={{ touchAction: "manipulation" }}>
      {GAME_RENDERER === "legacy" ? (
        <GameCanvas assets={gameplayAssets} userId={userId} username={username} gameState={gameState} localPosRef={localPosRef} send={send} />
      ) : (
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center bg-[#173d2b] text-[#fff1bd] font-bold">Packing the reserve…</div>}>
          <PhaserGame
            userId={userId}
            username={username}
            gameState={gameState}
            localPosRef={localPosRef}
            send={send}
            selectedAnimal={selectedAnimal}
            selectedLevel={selectedLevel}
            selectedPerk={selectedPerk}
            decoySpawn={decoySpawn}
          />
        </Suspense>
      )}

      {showCountdown && <CountdownOverlay endsAt={gameState?.countdownEndsAt ?? null} />}

      {gameState?.phase === "PLAYING" && (
        <>
          <GameHud state={gameState} player={me} eventLog={eventLog} connection={status} />
          {!me?.isAlive && !isHunter && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-[#14271fe8] border-2 border-[#d9b45d] text-[#fff3cb] px-6 sm:px-8 py-4 rounded-xl text-xl sm:text-2xl font-bold text-center">
              Your trail ends here
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
        onAuth={handleAdminAuth} onCommand={handleAdminCommand} onClearDenied={() => setAdminDenied(false)} onLogout={handleAdminLogout} />
      {isDebug() && session && <Diagnostics route={route} roomId={session.roomId} status={status} userId={userId}
        playerCount={gameState?.players.length ?? 0} phase={gameState?.phase ?? "—"} fps={fps} />}
    </div>
  );
}

function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("debug");
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
