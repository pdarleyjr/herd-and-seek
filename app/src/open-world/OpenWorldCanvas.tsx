import { useEffect, useRef, useState } from "react";
import {
  type OpenWorldZoneState,
  type OpenWorldProfile,
  type QuestProgress,
  type QuestId,
  DISTRICTS,
  OPEN_WORLD_WORLD_SIZE,
} from "./openWorldTypes";
import {
  drawWorld,
  drawMinimap,
  type Camera,
  type Particle,
  type QualityTier,
} from "./openWorldRenderer";
import { joystickVector, resolveContextAction, type ContextAction } from "./openWorldControls";

const LODGE = DISTRICTS.find((d) => d.id === "lodge")!;
const SYNC_INTERVAL_MS = 66; // ~15 Hz, matching the server broadcast rate.
const MOVE_SPEED = 320; // world units per second (frame-rate independent).

function qualityFor(width: number, reducedMotion: boolean): QualityTier {
  if (reducedMotion) return "balanced";
  if (width < 640) return "balanced";
  if (width < 1100) return "balanced";
  return "high";
}

interface OpenWorldCanvasProps {
  userId: string;
  username: string;
  animalType: string;
  zoneState: OpenWorldZoneState | null;
  profile: OpenWorldProfile | null;
  questProgress: Record<string, QuestProgress>;
  onSync: (x: number, y: number, animalType?: string) => void;
  onCollectNode: (nodeId: string) => void;
  onAcceptQuest: (questId: QuestId) => void;
  onClaimQuest: (questId: QuestId) => void;
}

export default function OpenWorldCanvas({
  userId,
  username,
  animalType,
  zoneState,
  profile,
  questProgress,
  onSync,
  onCollectNode,
  onAcceptQuest,
  onClaimQuest,
}: OpenWorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localPos = useRef({ x: LODGE.cx, y: LODGE.cy });
  const target = useRef<{ x: number; y: number } | null>(null);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyCurrent = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const lastSync = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const [contextAction, setContextAction] = useState<ContextAction | null>(null);
  const [usingTouch, setUsingTouch] = useState(false);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  // Keep latest server-driven values in refs so the rAF loop never restarts.
  const zoneRef = useRef(zoneState);
  const questRef = useRef(questProgress);
  const animalRef = useRef(animalType);
  useEffect(() => {
    zoneRef.current = zoneState;
    questRef.current = questProgress;
    animalRef.current = animalType;
  }, [zoneState, questProgress, animalType]);

  const lastActionKey = useRef("");

  // Sync local position reference into the zone once we know our server pos.
  useEffect(() => {
    if (!zoneState) return;
    const me = zoneState.players.find((p) => p.id === userId);
    if (me && localPos.current.x === LODGE.cx && localPos.current.y === LODGE.cy) {
      localPos.current = { x: me.x, y: me.y };
    }
  }, [zoneState, userId]);

  const spawnBurst = (x: number, y: number, text?: string) => {
    const arr = particlesRef.current;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      arr.push({ x, y, kind: "spark", age: 0, ttl: 0.6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30 });
    }
    if (text) arr.push({ x, y: y - 20, kind: "text", text, color: "#ffcf33", age: 0, ttl: 1.1, vx: 0, vy: -40 });
    if (arr.length > 200) arr.splice(0, arr.length - 200);
  };

  // Main render + movement loop (runs once).
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let prev = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - prev) / 1000, 0.05);
      prev = time;

      const dprCap = qualityFor(container.clientWidth, reducedMotion) === "high" ? 2 : 1.5;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam: Camera = { camX: localPos.current.x, camY: localPos.current.y, width: w, height: h, scale: 1 };

      // Movement input.
      const js = joyOrigin.current && joyCurrent.current
        ? joystickVector(joyOrigin.current, joyCurrent.current)
        : { dx: 0, dy: 0, magnitude: 0 };
      let mx = js.dx;
      let my = js.dy;
      if (keys.current["arrowleft"] || keys.current["a"]) mx -= 1;
      if (keys.current["arrowright"] || keys.current["d"]) mx += 1;
      if (keys.current["arrowup"] || keys.current["w"]) my -= 1;
      if (keys.current["arrowdown"] || keys.current["s"]) my += 1;

      if (target.current && Math.abs(mx) < 0.01 && Math.abs(my) < 0.01) {
        const dx = target.current.x - localPos.current.x;
        const dy = target.current.y - localPos.current.y;
        const d = Math.hypot(dx, dy);
        const step = MOVE_SPEED * dt;
        if (d <= step) {
          localPos.current = { x: target.current.x, y: target.current.y };
          target.current = null;
        } else {
          mx += (dx / d) * 0.8;
          my += (dy / d) * 0.8;
        }
      }

      const mlen = Math.hypot(mx, my);
      if (mlen > 0.001) {
        const speed = MOVE_SPEED * (mlen > 1 ? 1 : mlen) * dt;
        localPos.current.x = Math.max(40, Math.min(OPEN_WORLD_WORLD_SIZE - 40, localPos.current.x + (mx / mlen) * speed));
        localPos.current.y = Math.max(40, Math.min(OPEN_WORLD_WORLD_SIZE - 40, localPos.current.y + (my / mlen) * speed));
        if (time - lastSync.current > SYNC_INTERVAL_MS) {
          lastSync.current = time;
          onSync(localPos.current.x, localPos.current.y, animalRef.current);
        }
      }

      // Advance particles.
      const parts = particlesRef.current;
      for (const p of parts) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].ttl) parts.splice(i, 1);

      const zone = zoneRef.current;
      if (zone) {
        const quality = qualityFor(w, reducedMotion);
        drawWorld(ctx, cam, zone, {
          time,
          localId: userId,
          quality,
          particles: parts,
          reducedMotion,
        });

        // Minimap sits ABOVE the reserved bottom-right action zone (no overlap).
        const mSize = w < 640 ? 122 : 190;
        const margin = 14;
        const actionZoneH = 96;
        drawMinimap(ctx, w - mSize - margin, h - mSize - margin - actionZoneH, mSize, mSize, zone, userId);

        const action = resolveContextAction({
          zone,
          localX: localPos.current.x,
          localY: localPos.current.y,
          questProgress: questRef.current,
          lodge: { x: LODGE.cx, y: LODGE.cy },
        });
        const key = action ? `${action.kind}:${action.questId ?? ""}:${action.nodeId ?? ""}` : "";
        if (key !== lastActionKey.current) {
          lastActionKey.current = key;
          setContextAction(action);
        }
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [userId, onSync]);

  // Keyboard movement (desktop).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Virtual joystick (touch).
  const onJoyStart = (e: React.PointerEvent) => {
    setUsingTouch(true);
    joyOrigin.current = { x: e.clientX, y: e.clientY };
    joyCurrent.current = { x: e.clientX, y: e.clientY };
    setJoyKnob({ x: 0, y: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (!joyOrigin.current) return;
    joyCurrent.current = { x: e.clientX, y: e.clientY };
    const v = joystickVector(joyOrigin.current, joyCurrent.current, 60);
    setJoyKnob({ x: v.dx * 30, y: v.dy * 30 });
  };
  const onJoyEnd = () => {
    joyOrigin.current = null;
    joyCurrent.current = null;
    setJoyKnob({ x: 0, y: 0 });
  };

  const handleAction = () => {
    if (!contextAction) return;
    switch (contextAction.kind) {
      case "collect":
        if (contextAction.nodeId) {
          onCollectNode(contextAction.nodeId);
          spawnBurst(localPos.current.x, localPos.current.y, "Collected!");
        }
        break;
      case "accept":
        if (contextAction.questId) onAcceptQuest(contextAction.questId);
        break;
      case "claim":
        if (contextAction.questId) onClaimQuest(contextAction.questId);
        break;
      case "return":
        target.current = { x: LODGE.cx, y: LODGE.cy };
        break;
      default:
        break;
    }
  };

  const safeBottom = "max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))";
  const safeLeft = "max(16px, env(safe-area-inset-left))";
  const safeRight = "max(16px, env(safe-area-inset-right))";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#caa869]" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Virtual joystick (bottom-left) */}
      <div className="absolute z-20" style={{ left: safeLeft, bottom: safeBottom }}>
        <div
          onPointerDown={onJoyStart}
          onPointerMove={onJoyMove}
          onPointerUp={onJoyEnd}
          onPointerCancel={onJoyEnd}
          onLostPointerCapture={onJoyEnd}
          className="w-28 h-28 rounded-full bg-black/30 border-2 border-white/40 flex items-center justify-center touch-none select-none"
          style={{ touchAction: "none" }}
        >
          <div
            className="w-12 h-12 rounded-full bg-white/60"
            style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
          />
        </div>
      </div>

      {/* Context action button (bottom-right), never overlapping the minimap */}
      {contextAction && (
        <div className="absolute z-20" style={{ right: safeRight, bottom: safeBottom }}>
          <button
            type="button"
            onClick={handleAction}
            className="game-button game-button--primary min-h-[56px] px-5 py-4 text-sm sm:text-base"
          >
            {contextAction.label}
          </button>
        </div>
      )}

      {!usingTouch && (
        <div className="absolute z-10 bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full pointer-events-none">
          WASD / Arrows to move · walk to collectibles &amp; the lodge
        </div>
      )}

      <span className="hidden">{username}{profile ? profile.level : ""}</span>
    </div>
  );
}
