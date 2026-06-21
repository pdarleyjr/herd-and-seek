import { useEffect, useRef, useCallback, useState } from "react";
import { type AssetMap } from "./AssetLoader";
import {
  type SerializedState,
  type AnimalType,
  type PerkType,
  type ClientMessage,
  WORLD_SIZE,
  ANIMAL_SPEED,
  HUNTER_SPEED,
} from "./types";
import { soundManager } from "./SoundManager";

interface NpcEntity {
  id: number;
  x: number;
  y: number;
  animalType: AnimalType;
  vx: number;
  vy: number;
  state: "WANDER" | "IDLE";
  stateTimer: number;
  stateDuration: number;
}

interface TreeEntity {
  x: number;
  y: number;
  type: "green" | "brown" | "bush";
}

interface MuzzleFlash {
  x: number;
  y: number;
  life: number;
}

interface HitMarker {
  x: number;
  y: number;
  life: number;
  hit: boolean;
}

interface DecoyEntity {
  x: number;
  y: number;
  animalType: AnimalType;
  life: number;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface RockEntity {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  colorIdx: number; // 0=mid-grey, 1=dark-grey, 2=warm-grey
}

interface GrassPatch {
  x: number;
  y: number;
  count: number;
  spread: number;
  tall: boolean;
  seed: number;
  withFlower: boolean;
}

// Deterministic PRNG — returns values in [0,1) given a stable seed
function prng(seed: number) {
  let s = (seed | 0) + 1;
  return () => {
    s = ((s * 1664525) + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface GameCanvasProps {
  assets: AssetMap;
  userId: string;
  username: string;
  gameState: SerializedState | null;
  localPosRef: React.MutableRefObject<{ x: number; y: number }>;
  send: (msg: ClientMessage) => void;
}

function getAnimalImage(
  assets: AssetMap,
  type: AnimalType
): HTMLImageElement {
  return assets[type] || assets.elephant;
}

function generateTrees(): TreeEntity[] {
  const trees: TreeEntity[] = [];
  const count = 85; // denser forest
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    // More bushes in forest (30%), balanced green/brown trees
    const type: TreeEntity["type"] =
      r < 0.45 ? "green" : r < 0.70 ? "brown" : "bush";
    trees.push({
      x: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      type,
    });
  }
  return trees;
}

function generateRocks(): RockEntity[] {
  const rocks: RockEntity[] = [];
  const count = 45; // more rock clusters for cover
  for (let i = 0; i < count; i++) {
    const large = i < 12;
    rocks.push({
      x: Math.floor(Math.random() * (WORLD_SIZE - 240)) + 120,
      y: Math.floor(Math.random() * (WORLD_SIZE - 240)) + 120,
      rx: large ? 28 + Math.random() * 20 : 12 + Math.random() * 12,
      ry: large ? 18 + Math.random() * 12 : 7 + Math.random() * 9,
      rotation: Math.random() * Math.PI,
      colorIdx: Math.floor(Math.random() * 3),
    });
  }
  return rocks;
}

function generateGrassPatches(): GrassPatch[] {
  const patches: GrassPatch[] = [];
  for (let i = 0; i < 70; i++) { // denser undergrowth for hiding
    const tall = i < 30; // first 30 are definitely tall (hiding spots)
    patches.push({
      x: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      count: tall ? 7 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 4),
      spread: tall ? 22 + Math.floor(Math.random() * 22) : 14 + Math.floor(Math.random() * 16),
      tall,
      seed: Math.floor(Math.random() * 9999) + 1,
      withFlower: !tall && Math.random() < 0.35,
    });
  }
  return patches;
}

function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

const PERK_ICONS: Record<PerkType, string> = {
  sprint: "💨",
  camouflage: "🫥",
  extraLife: "❤️",
  decoy: "🎭",
  speedBoost: "⚡",
  none: "",
};

export default function GameCanvas({
  assets,
  userId,
  username,
  gameState,
  localPosRef,
  send,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const mouseRef = useRef({ x: 0, y: 0, worldX: 0, worldY: 0 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const npcsRef = useRef<NpcEntity[]>([]);
  const treesRef = useRef<TreeEntity[]>([]);
  const rocksRef = useRef<RockEntity[]>([]);
  const grassPatchesRef = useRef<GrassPatch[]>([]);
  const decoysRef = useRef<DecoyEntity[]>([]);
  const serverStateRef = useRef<SerializedState | null>(null);
  const gameTickRef = useRef(0);
  const lastSyncRef = useRef(0);
  const perkStateRef = useRef<{
    type: string;
    activeUntil: number;
    cooldownUntil: number;
  }>({ type: "none", activeUntil: 0, cooldownUntil: 0 });
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 800, h: 600 });
  const dustParticlesRef = useRef<
    { x: number; y: number; life: number; maxLife: number }[]
  >([]);
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);
  const hitMarkersRef = useRef<HitMarker[]>([]);
  const ambientParticlesRef = useRef<AmbientParticle[]>([]);
  const hunterAngleRef = useRef(0);
  const aimAngleRef = useRef(0);
  const remoteRenderRef = useRef<Map<string, { renderX: number; renderY: number; targetX: number; targetY: number }>>(new Map());
  const movePointerIdRef = useRef<number | null>(null);
  const aimPointerIdRef = useRef<number | null>(null);
  // Track aim touch start for tap-vs-drag detection
  const aimTapStartTimeRef = useRef(0);
  const aimTapStartXRef = useRef(0);
  const aimTapStartYRef = useRef(0);
  // World-space position of current aim target (used for crosshair rendering)
  const aimTargetRef = useRef<{ worldX: number; worldY: number } | null>(null);

  const [isMobile] = useState(() => isTouchDevice());
  const lastTimeRef = useRef(0);

  const aimRef = useRef<{
    active: boolean;
    touchId: number | null;
    currentX: number;
    currentY: number;
    worldX: number;
    worldY: number;
  }>({ active: false, touchId: null, currentX: 0, currentY: 0, worldX: 0, worldY: 0 });

  const [aimVisual, setAimVisual] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  const joystickRef = useRef<{
    active: boolean;
    touchId: number | null;
    originX: number;
    originY: number;
    dx: number;
    dy: number;
  }>({ active: false, touchId: null, originX: 0, originY: 0, dx: 0, dy: 0 });

  const [joystickVisual, setJoystickVisual] = useState<{
    visible: boolean;
    originX: number;
    originY: number;
    knobX: number;
    knobY: number;
  }>({ visible: false, originX: 0, originY: 0, knobX: 0, knobY: 0 });

  const [perkActiveState, setPerkActiveState] = useState<{
    active: boolean;
    cooldown: boolean;
    remaining: number;
  }>({ active: false, cooldown: false, remaining: 0 });

  useEffect(() => {
    if (!gameState) return;
    serverStateRef.current = gameState;

if (gameState.npcSeeds.length > 0 && npcsRef.current.length === 0) {
       npcsRef.current = gameState.npcSeeds.map((seed) => ({
         ...seed,
         vx: 0,
         vy: 0,
         state: Math.random() < 0.7 ? "WANDER" : "IDLE",
         stateTimer: 0,
         stateDuration: 90 + Math.floor(Math.random() * 180),
       }));
      const me = gameState.players.find((p) => p.id === userId);
      if (me) {
        localPosRef.current = { x: me.x, y: me.y };
        if (me.isHunter) {
          mouseRef.current = {
            x: canvasSizeRef.current.w / 2,
            y: canvasSizeRef.current.h / 2,
            worldX: me.x,
            worldY: me.y,
          };
        }
      }
      treesRef.current = generateTrees();
      rocksRef.current = generateRocks();
      grassPatchesRef.current = generateGrassPatches();
      soundManager.gameStart();
    }

    // Update remote player render targets for interpolation
    for (const p of gameState.players) {
      if (p.id === userId) continue;
      const existing = remoteRenderRef.current.get(p.id);
      if (existing) {
        existing.targetX = p.x;
        existing.targetY = p.y;
      } else {
        remoteRenderRef.current.set(p.id, { renderX: p.x, renderY: p.y, targetX: p.x, targetY: p.y });
      }
    }
    const playerIds = new Set(gameState.players.map((p) => p.id));
    for (const id of remoteRenderRef.current.keys()) {
      if (!playerIds.has(id)) remoteRenderRef.current.delete(id);
    }

    // Only snap local player on large discrepancy (e.g. Extra Life respawn)
    if (gameState.phase === "PLAYING") {
      const me = gameState.players.find((p) => p.id === userId);
      if (me && me.isAlive) {
        const errX = me.x - localPosRef.current.x;
        const errY = me.y - localPosRef.current.y;
        if (Math.hypot(errX, errY) > 200) {
          localPosRef.current = { x: me.x, y: me.y };
        }
      }
    }
  }, [gameState, userId]);

  const spawnAmbientParticle = useCallback(() => {
    if (ambientParticlesRef.current.length > 15) return;
    const cam = cameraRef.current;
    const w = canvasSizeRef.current.w;
    const h = canvasSizeRef.current.h;
    ambientParticlesRef.current.push({
      x: cam.x + Math.random() * w,
      y: cam.y + Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.3,
      life: 120 + Math.random() * 60,
      maxLife: 180,
      size: 2 + Math.random() * 3,
      color: Math.random() < 0.5 ? "rgba(255,255,200,0.3)" : "rgba(150,255,150,0.3)",
    });
  }, []);

  const updateNpcs = useCallback(() => {
    const npcs = npcsRef.current;
    for (const npc of npcs) {
      npc.stateTimer++;

      if (npc.stateTimer >= npc.stateDuration) {
        npc.state = Math.random() < 0.7 ? "WANDER" : "IDLE";
        npc.stateTimer = 0;
        npc.stateDuration = 90 + Math.floor(Math.random() * 180);

        if (npc.state === "WANDER") {
          const angle = Math.random() * Math.PI * 2;
          npc.vx = Math.cos(angle) * ANIMAL_SPEED;
          npc.vy = Math.sin(angle) * ANIMAL_SPEED;
        } else {
          npc.vx = 0;
          npc.vy = 0;
        }
      }

      if (npc.state === "WANDER") {
        npc.x += npc.vx;
        npc.y += npc.vy;

        if (npc.x <= 48 || npc.x >= WORLD_SIZE - 48) {
          npc.vx = -npc.vx;
          npc.x = Math.max(48, Math.min(WORLD_SIZE - 48, npc.x));
        }
        if (npc.y <= 48 || npc.y >= WORLD_SIZE - 48) {
          npc.vy = -npc.vy;
          npc.y = Math.max(48, Math.min(WORLD_SIZE - 48, npc.y));
        }
      }
    }

    for (let i = decoysRef.current.length - 1; i >= 0; i--) {
      const d = decoysRef.current[i];
      d.life--;
      if (d.life <= 0) decoysRef.current.splice(i, 1);
    }

    if (gameTickRef.current % 10 === 0) spawnAmbientParticle();

    for (let i = ambientParticlesRef.current.length - 1; i >= 0; i--) {
      const p = ambientParticlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) ambientParticlesRef.current.splice(i, 1);
    }
  }, [spawnAmbientParticle]);

const updateLocalPlayer = useCallback(() => {
    const state = serverStateRef.current;
    if (!state || state.phase !== "PLAYING") return;

    const me = state.players.find((p) => p.id === userId);
    if (!me || !me.isAlive) return;

    let dx = 0;
    let dy = 0;
    const keys = keysRef.current;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    if (isMobile && joystickRef.current.active) {
      dx = joystickRef.current.dx;
      dy = joystickRef.current.dy;
    }

    const isCamouflage =
      perkStateRef.current.type === "camouflage" &&
      Date.now() < perkStateRef.current.activeUntil;

    if (isCamouflage) {
      dx = 0;
      dy = 0;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
      }
    }

    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 16.67;
    lastTimeRef.current = now;
    const lerpDt = Math.min(1, Math.max(0, dt));

    const isSprinting =
      perkStateRef.current.type === "sprint" &&
      Date.now() < perkStateRef.current.activeUntil;

    let speed = me.isHunter ? HUNTER_SPEED : ANIMAL_SPEED;
    if (isSprinting) speed *= 1.5;
    if (me.perk === "speedBoost" && !me.isHunter) speed *= 1.3;

    const targetX = localPosRef.current.x + dx * speed * lerpDt;
    const targetY = localPosRef.current.y + dy * speed * lerpDt;

    localPosRef.current.x = Math.max(
      48,
      Math.min(WORLD_SIZE - 48, targetX)
    );
    localPosRef.current.y = Math.max(
      48,
      Math.min(WORLD_SIZE - 48, targetY)
    );

    // Soft server reconciliation: gently correct drift, snap on large errors
    const reconcileErrX = me.x - localPosRef.current.x;
    const reconcileErrY = me.y - localPosRef.current.y;
    const reconcileError = Math.hypot(reconcileErrX, reconcileErrY);
    if (reconcileError > 200) {
      localPosRef.current.x = me.x;
      localPosRef.current.y = me.y;
    } else if (reconcileError > 12) {
      localPosRef.current.x += reconcileErrX * 0.06;
      localPosRef.current.y += reconcileErrY * 0.06;
    }

    if (me.isHunter) {
      const aimDx = mouseRef.current.worldX - localPosRef.current.x;
      const aimDy = mouseRef.current.worldY - localPosRef.current.y;
      aimAngleRef.current = Math.atan2(aimDy, aimDx);
      hunterAngleRef.current = aimAngleRef.current + Math.PI / 2;
    }

    if (isSprinting && (dx !== 0 || dy !== 0)) {
      if (Math.random() < 0.4) {
        dustParticlesRef.current.push({
          x: localPosRef.current.x,
          y: localPosRef.current.y + 10,
          life: 30,
          maxLife: 30,
        });
      }
    }

    const nowMs = Date.now();
    const isActive = nowMs < perkStateRef.current.activeUntil;
    const isCooldown = nowMs < perkStateRef.current.cooldownUntil;
    setPerkActiveState({
      active: isActive,
      cooldown: isCooldown,
      remaining: isCooldown
        ? Math.ceil((perkStateRef.current.cooldownUntil - nowMs) / 1000)
        : 0,
    });

    if (nowMs - lastSyncRef.current > 1000 / 30) {
      lastSyncRef.current = nowMs;
      send({
        type: "SYNC",
        payload: { x: localPosRef.current.x, y: localPosRef.current.y },
      });
    }
  }, [userId, send, localPosRef, isMobile]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = canvasSizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // ── Rich forest terrain base ────────────────────────────────────────────
    ctx.fillStyle = "#3d7a25"; // darker, denser forest green
    ctx.fillRect(0, 0, w, h);

    const state = serverStateRef.current;
    if (!state) return;

    const me = state.players.find((p) => p.id === userId);
    if (me && me.isAlive) {
      cameraRef.current.x = localPosRef.current.x - w / 2;
      cameraRef.current.y = localPosRef.current.y - h / 2;
      cameraRef.current.x = Math.max(
        0,
        Math.min(WORLD_SIZE - w, cameraRef.current.x)
      );
      cameraRef.current.y = Math.max(
        0,
        Math.min(WORLD_SIZE - h, cameraRef.current.y)
      );
    }
    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;

    // Interpolate remote player render positions toward server targets (eliminates snap jitter)
    for (const rp of remoteRenderRef.current.values()) {
      rp.renderX += (rp.targetX - rp.renderX) * 0.18;
      rp.renderY += (rp.targetY - rp.renderY) * 0.18;
    }

    ctx.strokeStyle = "#1a3c0a";
    ctx.lineWidth = 12;
    ctx.strokeRect(-camX, -camY, WORLD_SIZE, WORLD_SIZE);

    // ── Terrain variation patches (world-coord, deterministic) ─────────────
    const PATCH_GRID = 160;
    const patchStartX = Math.floor(camX / PATCH_GRID) * PATCH_GRID;
    const patchStartY = Math.floor(camY / PATCH_GRID) * PATCH_GRID;
    for (let px = patchStartX - PATCH_GRID; px < camX + w + PATCH_GRID; px += PATCH_GRID) {
      for (let py = patchStartY - PATCH_GRID; py < camY + h + PATCH_GRID; py += PATCH_GRID) {
        const s = Math.abs((px * 7919 + py * 6271) & 0x7fffffff);
        if (s % 10 < 4) {
          const sx = px - camX + (s % PATCH_GRID) * 0.22;
          const sy = py - camY + ((s >> 8) % PATCH_GRID) * 0.22;
          const prx = 50 + (s & 55);
          const pry = 32 + ((s >> 4) & 40);
          ctx.fillStyle = s % 3 === 0 ? "rgba(22,80,8,0.11)" : "rgba(62,120,18,0.09)";
          ctx.beginPath();
          ctx.ellipse(sx, sy, prx, pry, (s & 3) * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Grid ───────────────────────────────────────────────────────────────
    const gridSize = 120;
    ctx.strokeStyle = "rgba(0,0,0,0.055)";
    ctx.lineWidth = 1;
    const startX = Math.floor(camX / gridSize) * gridSize;
    const startY = Math.floor(camY / gridSize) * gridSize;
    for (let x = startX; x < camX + w + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x - camX, 0);
      ctx.lineTo(x - camX, h);
      ctx.stroke();
    }
    for (let y = startY; y < camY + h + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y - camY);
      ctx.lineTo(w, y - camY);
      ctx.stroke();
    }

    // ── Grass patches (drawn before sprites — always behind entities) ───────
    for (const patch of grassPatchesRef.current) {
      const bx = patch.x - camX;
      const by = patch.y - camY;
      if (bx < -60 || bx > w + 60 || by < -60 || by > h + 60) continue;
      const rng = prng(patch.seed);
      const bladeH = patch.tall ? 20 : 12;
      for (let i = 0; i < patch.count; i++) {
        const ox = (rng() - 0.5) * patch.spread * 2;
        const oy = (rng() - 0.5) * patch.spread * 0.55;
        const bh = bladeH + rng() * 8;
        const sw = (rng() - 0.5) * 7;
        ctx.strokeStyle = i % 2 === 0 ? "#287810" : "#3a9818";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + ox, by + oy);
        ctx.quadraticCurveTo(bx + ox + sw, by + oy - bh * 0.55, bx + ox + sw * 1.4, by + oy - bh);
        ctx.stroke();
      }
      if (patch.withFlower) {
        const fx = bx;
        const fy = by - bladeH - 3;
        ctx.fillStyle = "#fffde0";
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5c030";
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of ambientParticlesRef.current) {
      const alpha = (p.life / p.maxLife) * 0.4;
      const sx = p.x - camX;
      const sy = p.y - camY;
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    interface RenderItem {
      x: number;
      y: number;
      img?: HTMLImageElement;
      drawFn?: (sx: number, sy: number) => void;
      rotation: number;
      size: number;
      isEntity: boolean;
      shadow: boolean;
      alpha: number;
      glow: string | null;
      flipX?: boolean; // mirror sprite horizontally (moving-left animals)
    }
    const renderArray: RenderItem[] = [];

    const isCamouflaged =
      perkStateRef.current.type === "camouflage" &&
      Date.now() < perkStateRef.current.activeUntil;

    for (const npc of npcsRef.current) {
      renderArray.push({
        x: npc.x,
        y: npc.y,
        img: getAnimalImage(assets, npc.animalType),
        rotation: 0,
        size: 64,
        isEntity: true,
        shadow: true,
        alpha: 1,
        glow: null,
        flipX: npc.vx < -0.1, // mirror when moving left
      });
    }

    for (const d of decoysRef.current) {
      const alpha = Math.min(1, d.life / 30);
      renderArray.push({
        x: d.x,
        y: d.y,
        img: getAnimalImage(assets, d.animalType),
        
        rotation: 0,
        size: 64,
        isEntity: true,
        shadow: true,
        alpha: alpha * 0.8,
        glow: null,
      });
    }

    for (const p of state.players) {
      if (!p.isAlive) continue;
      const img = p.isHunter
        ? assets.hunter
        : getAnimalImage(assets, p.animalType);
      const isLocal = p.id === userId;
      const remoteRender = !isLocal ? remoteRenderRef.current.get(p.id) : null;
      const px = isLocal ? localPosRef.current.x : (remoteRender?.renderX ?? p.x);
      const py = isLocal ? localPosRef.current.y : (remoteRender?.renderY ?? p.y);

let rotation = 0;
       let alpha = 1;
       let glow: string | null = null;

      if (p.isHunter) {
        rotation = hunterAngleRef.current;
      }

      if (isLocal && isCamouflaged) {
        alpha = 0.5;
        glow = "rgba(150, 100, 255, 0.4)";
      }

      if (isLocal && p.perk === "extraLife" && !p.extraLifeUsed) {
        glow = "rgba(255, 100, 100, 0.3)";
      }

      if (isLocal && p.perk === "speedBoost") {
        glow = "rgba(255, 220, 50, 0.2)";
      }

renderArray.push({
         x: px,
         y: py,
         img,
         rotation,
         size: 64,
         isEntity: true,
         shadow: true,
         alpha,
         glow,
       });
    }

    for (const t of treesRef.current) {
const img =
        t.type === "bush" ? assets.bush : t.type === "brown" ? assets.treeBrown : assets.tree;
      renderArray.push({
        x: t.x,
        y: t.y,
        img,
        rotation: 0,
        size: t.type === "bush" ? 52 : 88,
        isEntity: false,
        shadow: t.type !== "bush",
        alpha: 1,
        glow: null,
      });
    }

    // Rocks — added as drawFn items so they sort correctly with sprites
    const rockColors = ["#8a8878", "#787868", "#9a9a88"];
    for (const rock of rocksRef.current) {
      const { x, y, rx, ry, rotation, colorIdx } = rock;
      renderArray.push({
        x,
        y,
        rotation: 0,
        size: rx,
        isEntity: false,
        shadow: false,
        alpha: 1,
        glow: null,
        drawFn: (sx: number, sy: number) => {
          // Rock shadow
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.beginPath();
          ctx.ellipse(sx + rx * 0.28, sy + ry * 0.55, rx * 0.82, ry * 0.42, rotation, 0, Math.PI * 2);
          ctx.fill();
          // Rock body
          ctx.fillStyle = rockColors[colorIdx];
          ctx.beginPath();
          ctx.ellipse(sx, sy, rx, ry, rotation, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.beginPath();
          ctx.ellipse(sx - rx * 0.22, sy - ry * 0.22, rx * 0.38, ry * 0.28, rotation - 0.4, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    }

    renderArray.sort((a, b) => a.y - b.y);

for (const item of renderArray) {
      const screenX = item.x - camX;
      const screenY = item.y - camY;

      if (screenX < -100 || screenX > w + 100 || screenY < -100 || screenY > h + 100) continue;

      if (item.shadow) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + item.size * 0.35, item.size * 0.4, item.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (item.glow) {
        const glowGrd = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, item.size);
        glowGrd.addColorStop(0, item.glow);
        glowGrd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glowGrd;
        ctx.beginPath();
        ctx.arc(screenX, screenY, item.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (item.drawFn) {
        // Procedural draw (rocks etc.) — already handles its own shadow
        item.drawFn(screenX, screenY);
      } else if (item.img) {
        ctx.save();
        ctx.globalAlpha = item.alpha;
        ctx.translate(screenX, screenY);
        if (item.rotation !== 0) ctx.rotate(item.rotation);
        if (item.flipX) ctx.scale(-1, 1); // mirror for leftward-moving sprites
        ctx.drawImage(item.img, -item.size / 2, -item.size / 2, item.size, item.size);
        ctx.restore();
      }
    }

    // Draw username tags above animals (only visible to non-hunters)
    if (!isHunter) {
      for (const p of state.players) {
        if (!p.isAlive || p.isHunter) continue;
        const px = p.id === userId ? localPosRef.current.x : p.x;
        const py = p.id === userId ? localPosRef.current.y : p.y;
        const screenX = px - camX;
        const screenY = py - camY;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        const text = p.id === userId ? `YOU (${username})` : `${p.username}`;
        ctx.font = "bold 12px system-ui";
        const textW = ctx.measureText(text).width;
        ctx.fillRect(screenX - textW / 2 - 4, screenY - 45, textW + 8, 16);
        ctx.fillStyle = p.id === userId ? "#5fde5f" : "#ffd700";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, screenX, screenY - 38);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    if (me && me.isAlive && !me.isHunter) {
      const screenX = localPosRef.current.x - camX;
      const screenY = localPosRef.current.y - camY;

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const text = `YOU (${username})`;
      ctx.font = "bold 14px system-ui";
      const textW = ctx.measureText(text).width;
      ctx.fillRect(screenX - textW / 2 - 6, screenY - 55, textW + 12, 22);
      ctx.fillStyle = "#5fde5f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, screenX, screenY - 44);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      ctx.strokeStyle = "rgba(95, 222, 95, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(screenX, screenY, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

if (me && me.isAlive && me.isHunter) {
      const screenX = localPosRef.current.x - camX;
      const screenY = localPosRef.current.y - camY;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const text = `HUNTER (${username})`;
      ctx.font = "bold 14px system-ui";
      const textW = ctx.measureText(text).width;
      ctx.fillRect(screenX - textW / 2 - 6, screenY - 55, textW + 12, 22);
      ctx.fillStyle = "#ff6b6b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, screenX, screenY - 44);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // ── Minimap — role-aware with hunter radar mechanic ──────────────
    const MM = 134;   // minimap size
    const MX = 10;    // top-left x
    const MY = 10;    // top-left y
    const INSET = 16; // label header height

    // Radar timing: 10-second total cycle (5s reveal + 5s scan)
    const CYCLE_MS = 10_000;
    const REVEAL_MS = 5_000;
    const nowMsMap = Date.now();
    const radarPhase = nowMsMap % CYCLE_MS;
    const radarRevealed = radarPhase < REVEAL_MS;
    const msTillChange = radarRevealed ? REVEAL_MS - radarPhase : CYCLE_MS - radarPhase;
    const secsTillChange = Math.ceil(msTillChange / 1000);

    const isHunterLocal = me?.isHunter ?? false;

    // Background
    ctx.fillStyle = isHunterLocal
      ? (radarRevealed ? "rgba(35,4,4,0.88)" : "rgba(2,4,25,0.88)")
      : "rgba(2,16,2,0.85)";
    ctx.fillRect(MX, MY, MM, MM);

    // Border — colour signals radar state
    ctx.strokeStyle = isHunterLocal
      ? (radarRevealed ? "rgba(255,100,30,0.9)" : "rgba(80,140,255,0.7)")
      : "rgba(80,220,80,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(MX, MY, MM, MM);

    // Header label
    ctx.fillStyle = isHunterLocal
      ? (radarRevealed ? "#ff8844" : "#7aadff")
      : "#6fff6f";
    ctx.font = "bold 8px system-ui";
    ctx.textAlign = "center";
    const mmLabel = isHunterLocal
      ? (radarRevealed ? "▶ RADAR ACTIVE" : "◌ SCANNING...")
      : "▲ YOUR LOCATION";
    ctx.fillText(mmLabel, MX + MM / 2, MY + 9);
    ctx.textAlign = "left";

    // Content area (below label)
    const CX = MX + 4;
    const CY = MY + INSET;
    const CS = MM - 8; // content width/height

    // Clip to content area for sweep
    ctx.save();
    ctx.beginPath();
    ctx.rect(CX, CY, CS, CS);
    ctx.clip();

    // Map boundary
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(CX, CY, CS, CS);

    // Tree dots
    for (const t of treesRef.current) {
      const mx = CX + (t.x / WORLD_SIZE) * CS;
      const my = CY + (t.y / WORLD_SIZE) * CS;
      ctx.fillStyle = t.type === "bush" ? "rgba(60,180,40,0.6)" : "rgba(30,100,15,0.6)";
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

    // Rock dots
    for (const r of rocksRef.current) {
      const mx = CX + (r.x / WORLD_SIZE) * CS;
      const my = CY + (r.y / WORLD_SIZE) * CS;
      ctx.fillStyle = "rgba(100,90,80,0.4)";
      ctx.fillRect(mx - 0.5, my - 0.5, 1.5, 1.5);
    }

    if (isHunterLocal) {
      if (!radarRevealed) {
        // ── Scanning phase: rotating sweep line ─────────────────────
        const sweepAngle = ((nowMsMap % 3200) / 3200) * Math.PI * 2;
        const ccx = CX + CS / 2;
        const ccy = CY + CS / 2;
        // Trailing glow arcs
        for (let i = 8; i >= 0; i--) {
          const a = sweepAngle - (i / 9) * (Math.PI * 0.55);
          const alpha = ((9 - i) / 9) * 0.28;
          ctx.strokeStyle = `rgba(80,140,255,${alpha})`;
          ctx.lineWidth = CS * 0.7;
          ctx.beginPath();
          ctx.moveTo(ccx, ccy);
          const ex = ccx + Math.cos(a) * CS;
          const ey = ccy + Math.sin(a) * CS;
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        // Sweep leading edge
        ctx.strokeStyle = "rgba(130,200,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ccx, ccy);
        ctx.lineTo(
          ccx + Math.cos(sweepAngle) * (CS / 2 + 4),
          ccy + Math.sin(sweepAngle) * (CS / 2 + 4),
        );
        ctx.stroke();

        // Countdown text
        ctx.fillStyle = "rgba(130,185,255,0.85)";
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${secsTillChange}s`, ccx, ccy + 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      } else {
        // ── Reveal phase: pulsing enemy dots ────────────────────────
        const pulse = Math.sin(gameTickRef.current * 0.18) * 1.8;
        for (const p of state.players) {
          if (!p.isAlive || p.isHunter) continue;
          const mx = CX + (p.x / WORLD_SIZE) * CS;
          const my = CY + (p.y / WORLD_SIZE) * CS;
          // Glow ring
          ctx.fillStyle = "rgba(255,60,60,0.22)";
          ctx.beginPath();
          ctx.arc(mx, my, 5 + pulse, 0, Math.PI * 2);
          ctx.fill();
          // Solid dot
          ctx.fillStyle = "#ff3333";
          ctx.beginPath();
          ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
          ctx.fill();
          // Small crosshair
          ctx.strokeStyle = "rgba(255,120,120,0.7)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(mx - 5, my); ctx.lineTo(mx + 5, my);
          ctx.moveTo(mx, my - 5); ctx.lineTo(mx, my + 5);
          ctx.stroke();
        }
        // Countdown
        ctx.fillStyle = "rgba(255,160,80,0.75)";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`${secsTillChange}s`, CX + CS / 2, CY + CS - 3);
        ctx.textAlign = "left";
      }

      // Hunter own dot (always visible, orange)
      if (me && me.isAlive) {
        const hx = CX + (localPosRef.current.x / WORLD_SIZE) * CS;
        const hy = CY + (localPosRef.current.y / WORLD_SIZE) * CS;
        ctx.fillStyle = "#ff9900";
        ctx.beginPath();
        ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Aim direction triangle
        const ang = aimAngleRef.current;
        ctx.fillStyle = "rgba(255,180,0,0.85)";
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7);
        ctx.lineTo(hx + Math.cos(ang + 2.4) * 3.5, hy + Math.sin(ang + 2.4) * 3.5);
        ctx.lineTo(hx + Math.cos(ang - 2.4) * 3.5, hy + Math.sin(ang - 2.4) * 3.5);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // ── Animal view: only own location, no hunter or other animals ─
      if (me && me.isAlive) {
        const mx = CX + (localPosRef.current.x / WORLD_SIZE) * CS;
        const my = CY + (localPosRef.current.y / WORLD_SIZE) * CS;
        const pulse = (Math.sin(gameTickRef.current * 0.13) + 1) * 1.6;
        // Glow
        ctx.fillStyle = "rgba(100,255,80,0.2)";
        ctx.beginPath();
        ctx.arc(mx, my, 6 + pulse, 0, Math.PI * 2);
        ctx.fill();
        // Dot
        ctx.fillStyle = "#7fff00";
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore(); // remove clip

    for (let i = dustParticlesRef.current.length - 1; i >= 0; i--) {
      const p = dustParticlesRef.current[i];
      p.life--;
      if (p.life <= 0) {
        dustParticlesRef.current.splice(i, 1);
        continue;
      }
      const alpha = p.life / p.maxLife;
      const screenX = p.x - camX;
      const screenY = p.y - camY;
      ctx.fillStyle = `rgba(200, 180, 140, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, (1 - alpha) * 15 + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = muzzleFlashesRef.current.length - 1; i >= 0; i--) {
      const mf = muzzleFlashesRef.current[i];
      mf.life--;
      if (mf.life <= 0) {
        muzzleFlashesRef.current.splice(i, 1);
        continue;
      }
      const alpha = mf.life / 8;
      const sx = mf.x - camX;
      const sy = mf.y - camY;
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (1 - alpha) * 25 + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 120, 40, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (1 - alpha) * 15 + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = hitMarkersRef.current.length - 1; i >= 0; i--) {
      const hm = hitMarkersRef.current[i];
      hm.life--;
      if (hm.life <= 0) {
        hitMarkersRef.current.splice(i, 1);
        continue;
      }
      const alpha = hm.life / 30;
      const sx = hm.x - camX;
      const sy = hm.y - camY;
      const color = hm.hit ? "rgba(255, 60, 60" : "rgba(200, 200, 200";
      ctx.strokeStyle = `${color}, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 20 + (1 - alpha) * 15, 0, Math.PI * 2);
      ctx.stroke();
      if (hm.hit) {
        ctx.beginPath();
        ctx.moveTo(sx - 10, sy - 10);
        ctx.lineTo(sx + 10, sy + 10);
        ctx.moveTo(sx + 10, sy - 10);
        ctx.lineTo(sx - 10, sy + 10);
        ctx.stroke();
      }
    }

    if (me && me.isHunter && me.isAlive) {
      // Use actual aim target world position (tap position) when available; fall back to angle-based
      const crosshairWorldX = aimTargetRef.current ? aimTargetRef.current.worldX
        : (isMobile ? localPosRef.current.x + Math.cos(aimAngleRef.current) * 200 : mouseRef.current.worldX);
      const crosshairWorldY = aimTargetRef.current ? aimTargetRef.current.worldY
        : (isMobile ? localPosRef.current.y + Math.sin(aimAngleRef.current) * 200 : mouseRef.current.worldY);
      const mx = crosshairWorldX - camX;
      const my = crosshairWorldY - camY;

      // Draw faint tracer line from hunter to crosshair so aim direction is obvious
      const hunterSX = localPosRef.current.x - camX;
      const hunterSY = localPosRef.current.y - camY;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 80, 80, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(hunterSX, hunterSY);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const pulse = Math.sin(gameTickRef.current * 0.15) * 3;
      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 22 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.arc(mx, my, 30 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 14, my);
      ctx.lineTo(mx + 14, my);
      ctx.moveTo(mx, my - 14);
      ctx.lineTo(mx, my + 14);
      ctx.stroke();
    }

    if (state.phase === "PLAYING") {
      // ── Base dark vignette ──────────────────────────────────────────
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.32)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // ── Animal danger proximity warning ────────────────────────────
      // Pulsing red edge when hunter is within DANGER_RADIUS world units
      if (me && !me.isHunter && me.isAlive) {
        const hunter = state.players.find((p) => p.isHunter && p.isAlive);
        if (hunter) {
          const distToHunter = Math.hypot(
            hunter.x - localPosRef.current.x,
            hunter.y - localPosRef.current.y,
          );
          const DANGER_RADIUS = 420;
          if (distToHunter < DANGER_RADIUS) {
            const rawIntensity = 1 - distToHunter / DANGER_RADIUS;
            // Heartbeat pulse: two quick beats per second
            const beatPhase = (gameTickRef.current % 60) / 60;
            const beat = beatPhase < 0.12 ? beatPhase / 0.12
              : beatPhase < 0.22 ? (0.22 - beatPhase) / 0.10
              : beatPhase < 0.34 ? (beatPhase - 0.22) / 0.12
              : beatPhase < 0.44 ? (0.44 - beatPhase) / 0.10
              : 0;
            const intensity = rawIntensity * (0.25 + beat * 0.45);
            const dv = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.7);
            dv.addColorStop(0, "rgba(255,0,0,0)");
            dv.addColorStop(1, `rgba(200,0,0,${intensity.toFixed(3)})`);
            ctx.fillStyle = dv;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }

      // ── Time-pressure vignette (<20 s remaining) ───────────────────
      if (state.timeRemaining <= 20 && state.timeRemaining > 0) {
        const urgency = (20 - state.timeRemaining) / 20; // 0→1 as time runs out
        const timePulse = (Math.sin(gameTickRef.current * (0.1 + urgency * 0.25)) + 1) * 0.5;
        const timeAlpha = urgency * 0.22 * timePulse;
        if (timeAlpha > 0.01) {
          const tv = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
          tv.addColorStop(0, "rgba(0,0,0,0)");
          tv.addColorStop(1, `rgba(180,60,0,${timeAlpha.toFixed(3)})`);
          ctx.fillStyle = tv;
          ctx.fillRect(0, 0, w, h);
        }
      }
    }

    // ── Cover / hiding indicator for animals ───────────────────────────
    if (me && !me.isHunter && me.isAlive && state.phase === "PLAYING") {
      const px = localPosRef.current.x;
      const py = localPosRef.current.y;
      const COVER_RADIUS = 42; // world units — must be inside the patch
      const inCover = grassPatchesRef.current.some((patch) => {
        if (!patch.tall) return false;
        const d = Math.hypot(px - patch.x, py - patch.y);
        return d < patch.spread + COVER_RADIUS;
      });

      if (inCover) {
        const screenX = px - camX;
        const screenY = py - camY;
        // Green glow around player
        const coverGrd = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 44);
        coverGrd.addColorStop(0, "rgba(60,200,40,0.28)");
        coverGrd.addColorStop(1, "rgba(60,200,40,0)");
        ctx.fillStyle = coverGrd;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 44, 0, Math.PI * 2);
        ctx.fill();
        // "HIDDEN" badge
        ctx.fillStyle = "rgba(20,90,10,0.85)";
        ctx.beginPath();
        ctx.roundRect(screenX - 34, screenY - 68, 68, 18, 5);
        ctx.fill();
        ctx.fillStyle = "#7fff00";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🌿 HIDDEN", screenX, screenY - 59);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    gameTickRef.current++;
  }, [assets, userId, localPosRef, username]);

  const gameLoop = useCallback(() => {
    updateNpcs();
    updateLocalPlayer();
    render();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [updateNpcs, updateLocalPlayer, render]);

  const activatePerk = useCallback(() => {
    const state = serverStateRef.current;
    if (!state || state.phase !== "PLAYING") return;
    const me = state.players.find((p) => p.id === userId);
    if (!me || me.isHunter || !me.isAlive) return;

    const now = Date.now();
    if (now < perkStateRef.current.cooldownUntil) return;

    soundManager.perk();

    if (me.perk === "sprint") {
      perkStateRef.current = {
        type: "sprint",
        activeUntil: now + 1500,
        cooldownUntil: now + 6000,
      };
    } else if (me.perk === "camouflage") {
      perkStateRef.current = {
        type: "camouflage",
        activeUntil: now + 3000,
        cooldownUntil: now + 8000,
      };
    } else if (me.perk === "decoy") {
      send({ type: "DECOY", payload: {} });
      perkStateRef.current = {
        type: "decoy",
        activeUntil: 0,
        cooldownUntil: now + 10000,
      };
decoysRef.current.push({
         x: localPosRef.current.x,
         y: localPosRef.current.y,
         animalType: me.animalType,
         life: 300,
       });
    }
  }, [userId, send, localPosRef]);

  // Shoot at the current aim world position (crosshair / mouse / drag target).
  // Server does a point-vs-player check — target must be near an actual player.
  const fireShot = useCallback(() => {
    const state = serverStateRef.current;
    if (!state || state.phase !== "PLAYING") return;
    const me = state.players.find((p) => p.id === userId);
    if (!me || !me.isHunter || !me.isAlive) return;

    // Resolve target: aim drag position (mobile) → mouse world pos (desktop) → forward fallback
    let tX: number;
    let tY: number;

    if (aimTargetRef.current) {
      // Mobile drag or previous aim target — this is the crosshair's exact world location
      tX = aimTargetRef.current.worldX;
      tY = aimTargetRef.current.worldY;
    } else if (!isMobile && (mouseRef.current.worldX !== 0 || mouseRef.current.worldY !== 0)) {
      // Desktop — fire exactly at the mouse cursor world position
      tX = mouseRef.current.worldX;
      tY = mouseRef.current.worldY;
    } else {
      // Last-resort fallback: fire forward along aim angle (600 units)
      const a = aimAngleRef.current;
      tX = localPosRef.current.x + Math.cos(a) * 600;
      tY = localPosRef.current.y + Math.sin(a) * 600;
    }

    // Keep aim angle consistent with shot direction
    const dx = tX - localPosRef.current.x;
    const dy = tY - localPosRef.current.y;
    aimAngleRef.current = Math.atan2(dy, dx);
    hunterAngleRef.current = aimAngleRef.current + Math.PI / 2;
    aimTargetRef.current = { worldX: tX, worldY: tY };

    const muzzle = {
      x: localPosRef.current.x + Math.cos(aimAngleRef.current) * 40,
      y: localPosRef.current.y + Math.sin(aimAngleRef.current) * 40,
    };
    muzzleFlashesRef.current.push({ x: muzzle.x, y: muzzle.y, life: 8 });
    hitMarkersRef.current.push({ x: tX, y: tY, life: 30, hit: false });

    soundManager.gunshot();
    send({ type: "SHOOT", payload: { targetX: tX, targetY: tY } });
  }, [userId, send, localPosRef, aimAngleRef, aimTargetRef, isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      // Use visualViewport when available (handles iOS address bar correctly)
      const vv = window.visualViewport;
      const w = vv ? Math.floor(vv.width) : window.innerWidth;
      const h = vv ? Math.floor(vv.height) : window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      canvasSizeRef.current = { w, h };
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    window.visualViewport?.addEventListener("resize", resize);

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;

      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isAlive) return;

      if ((key === "shift" || key === "e") && !me.isHunter) {
        activatePerk();
      }

      if ((key === " " || key === "enter") && me.isHunter) {
        fireShot();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.worldX = e.clientX + cameraRef.current.x;
      mouseRef.current.worldY = e.clientY + cameraRef.current.y;
    };

    const onClick = () => {
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isHunter || !me.isAlive) return;
      fireShot();
    };

    // ── Pointer events (iOS-safe: no setPointerCapture on aim zone) ──
    const onPointerDown = (e: PointerEvent) => {
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isAlive) return;

      const w = window.innerWidth;
      const isMovementZone = !me.isHunter || e.clientX < w * 0.45;
      const isAimZone = me.isHunter && e.clientX >= w * 0.45;

      if (isMovementZone && movePointerIdRef.current === null) {
        // Keep pointer capture for joystick so dragging stays smooth
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* iOS may reject */ }
        movePointerIdRef.current = e.pointerId;
        joystickRef.current.active = true;
        joystickRef.current.touchId = e.pointerId;
        joystickRef.current.originX = e.clientX;
        joystickRef.current.originY = e.clientY;
        joystickRef.current.dx = 0;
        joystickRef.current.dy = 0;
        setJoystickVisual({ visible: true, originX: e.clientX, originY: e.clientY, knobX: e.clientX, knobY: e.clientY });
      } else if (isAimZone && aimPointerIdRef.current === null) {
        // No setPointerCapture on aim — lets fire button receive its own pointer events on iOS
        aimPointerIdRef.current = e.pointerId;
        aimTapStartTimeRef.current = Date.now();
        aimTapStartXRef.current = e.clientX;
        aimTapStartYRef.current = e.clientY;

        const worldX = e.clientX + cameraRef.current.x;
        const worldY = e.clientY + cameraRef.current.y;
        aimTargetRef.current = { worldX, worldY };

        const aimDx = worldX - localPosRef.current.x;
        const aimDy = worldY - localPosRef.current.y;
        aimAngleRef.current = Math.atan2(aimDy, aimDx);
        hunterAngleRef.current = aimAngleRef.current + Math.PI / 2;
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        mouseRef.current.worldX = worldX;
        mouseRef.current.worldY = worldY;
        setAimVisual({ visible: true, x: e.clientX, y: e.clientY });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (movePointerIdRef.current === e.pointerId) {
        const dx = e.clientX - joystickRef.current.originX;
        const dy = e.clientY - joystickRef.current.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 60;
        if (dist > maxDist) {
          const angle = Math.atan2(dy, dx);
          joystickRef.current.dx = Math.cos(angle);
          joystickRef.current.dy = Math.sin(angle);
          setJoystickVisual((prev) => ({ ...prev, knobX: prev.originX + Math.cos(angle) * maxDist, knobY: prev.originY + Math.sin(angle) * maxDist }));
        } else {
          joystickRef.current.dx = dx / maxDist;
          joystickRef.current.dy = dy / maxDist;
          setJoystickVisual((prev) => ({ ...prev, knobX: e.clientX, knobY: e.clientY }));
        }
      } else if (aimPointerIdRef.current === e.pointerId) {
        const worldX = e.clientX + cameraRef.current.x;
        const worldY = e.clientY + cameraRef.current.y;
        // Track aim target at the actual touch position
        aimTargetRef.current = { worldX, worldY };
        const aimDx = worldX - localPosRef.current.x;
        const aimDy = worldY - localPosRef.current.y;
        aimAngleRef.current = Math.atan2(aimDy, aimDx);
        hunterAngleRef.current = aimAngleRef.current + Math.PI / 2;
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        mouseRef.current.worldX = worldX;
        mouseRef.current.worldY = worldY;
        setAimVisual({ visible: true, x: e.clientX, y: e.clientY });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (movePointerIdRef.current === e.pointerId) {
        movePointerIdRef.current = null;
        joystickRef.current.active = false;
        joystickRef.current.touchId = null;
        joystickRef.current.dx = 0;
        joystickRef.current.dy = 0;
        setJoystickVisual({ visible: false, originX: 0, originY: 0, knobX: 0, knobY: 0 });
      } else if (aimPointerIdRef.current === e.pointerId) {
        aimPointerIdRef.current = null;
        aimRef.current.active = false;
        aimRef.current.touchId = null;

        // Drag to aim — tap-to-fire removed to eliminate accidental misfires.
        // Use the FIRE button (bottom-right) to shoot.
        setAimVisual({ visible: false, x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop, userId, send, fireShot]);

  const currentMe = gameState?.players.find((p) => p.id === userId);
  const hasPerk = currentMe && !currentMe.isHunter && currentMe.isAlive && currentMe.perk !== "none";
  const isHunter = currentMe?.isHunter ?? false;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 touch-none"
        style={{ touchAction: "none" }}
      />

      {isMobile && joystickVisual.visible && (
        <div className="absolute z-5 pointer-events-none" style={{ left: 0, top: 0 }}>
          <div
            className="absolute rounded-full border-4 border-white/30 bg-white/10"
            style={{
              width: 120,
              height: 120,
              left: joystickVisual.originX - 60,
              top: joystickVisual.originY - 60,
            }}
          />
          <div
            className="absolute rounded-full bg-white/60 border-2 border-white/80"
            style={{
              width: 50,
              height: 50,
              left: joystickVisual.knobX - 25,
              top: joystickVisual.knobY - 25,
            }}
          />
        </div>
      )}

      {isMobile && aimVisual.visible && (
        <div
          className="absolute z-5 pointer-events-none"
          style={{
            left: aimVisual.x - 40,
            top: aimVisual.y - 40,
            width: 80,
            height: 80,
          }}
        >
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-red-400/90" style={{ boxShadow: "0 0 10px rgba(255,60,60,0.5)" }} />
          {/* Inner dot */}
          <div className="absolute" style={{ left: "50%", top: "50%", width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: "50%", background: "rgba(255,80,80,0.9)" }} />
          {/* Cross-hairs */}
          <div className="absolute" style={{ left: "50%", top: 4, width: 2, height: "calc(50% - 8px)", marginLeft: -1, background: "rgba(255,80,80,0.8)" }} />
          <div className="absolute" style={{ left: "50%", bottom: 4, width: 2, height: "calc(50% - 8px)", marginLeft: -1, background: "rgba(255,80,80,0.8)" }} />
          <div className="absolute" style={{ top: "50%", left: 4, height: 2, width: "calc(50% - 8px)", marginTop: -1, background: "rgba(255,80,80,0.8)" }} />
          <div className="absolute" style={{ top: "50%", right: 4, height: 2, width: "calc(50% - 8px)", marginTop: -1, background: "rgba(255,80,80,0.8)" }} />
        </div>
      )}

      {isMobile && currentMe?.isHunter && gameState?.phase === "PLAYING" && (
        <>
          {/* Hunter control hint — only shows first few seconds */}
          {gameState.timeRemaining > (gameState.matchDuration - 8) && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{ top: "22%", left: "46%", right: "2%", textAlign: "center" }}
            >
              <div className="inline-flex flex-col gap-1 bg-black/70 rounded-xl px-4 py-2">
                <span className="text-white/90 text-sm font-bold">🎮 Hunter Controls</span>
                <span className="text-white/70 text-xs">Drag right → Aim crosshair</span>
                <span className="text-red-300 text-xs font-bold">Big red button → FIRE</span>
              </div>
            </div>
          )}

          {/* FIRE button — prominent, bottom-right, hard to miss */}
          <div
            className="absolute z-10"
            style={{
              bottom: "max(20px, env(safe-area-inset-bottom, 20px))",
              right: "max(16px, env(safe-area-inset-right, 16px))",
            }}
          >
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fireShot();
              }}
              className="rounded-full flex flex-col items-center justify-center active:scale-90 transition-transform select-none"
              style={{
                width: 96,
                height: 96,
                background: "radial-gradient(circle at 38% 32%, #ff6060, #cc1010)",
                border: "4px solid rgba(255,140,140,0.9)",
                boxShadow: "0 0 28px rgba(255,40,40,0.65), 0 4px 12px rgba(0,0,0,0.5)",
                touchAction: "manipulation",
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1 }}>🔫</span>
              <span style={{ color: "white", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", marginTop: 2 }}>FIRE</span>
            </button>
          </div>
        </>
      )}

{/* Perk button - bottom center for animals */}
       {isMobile && hasPerk && gameState?.phase === "PLAYING" && (
         <button
           onPointerDown={(e) => {
             e.preventDefault();
             activatePerk();
           }}
           className={`absolute bottom-44 sm:bottom-20 left-1/2 -translate-x-1/2 z-10 w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center transition-all select-none ${
             perkActiveState.cooldown
               ? "bg-gray-600/70 border-gray-400 opacity-50"
               : perkActiveState.active
               ? "bg-green-500/90 border-green-200 scale-110"
               : "bg-blue-500/80 border-blue-200 active:scale-95"
           }`}
           style={{ touchAction: "manipulation" }}
         >
<span className="text-2xl">{PERK_ICONS[currentMe?.perk ?? "none"]}</span>
            {perkActiveState.cooldown && (
              <span className="text-xs text-white font-bold">{perkActiveState.remaining}s</span>
            )}
          </button>
        )}

      {/* Hunter hint display - which animal each player is */}
      {isHunter && gameState?.phase === "PLAYING" && gameState.ammo <= gameState.maxAmmo / 2 && (
        <div className="absolute top-20 sm:top-16 left-1/2 -translate-x-1/2 z-10 bg-black/80 text-white px-3 py-2 rounded-lg max-w-[280px]">
          <p className="text-xs font-bold text-yellow-300 mb-1">Enemy Identities:</p>
          {gameState.players.filter(p => !p.isHunter && p.isAlive).map((p) => (
            <p key={p.id} className="text-xs">
              {p.username}: <span className="text-yellow-200">{p.animalType}</span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}



