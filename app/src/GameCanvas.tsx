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
  const count = 35;
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const type: TreeEntity["type"] =
      r < 0.5 ? "green" : r < 0.8 ? "brown" : "bush";
    trees.push({
      x: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      y: Math.floor(Math.random() * (WORLD_SIZE - 200)) + 100,
      type,
    });
  }
  return trees;
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

    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    grd.addColorStop(0, "#5a8c4a");
    grd.addColorStop(1, "#2a5c1a");
    ctx.fillStyle = grd;
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

    const gridSize = 100;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
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
      img: HTMLImageElement;
      
      rotation: number;
      size: number;
      isEntity: boolean;
      shadow: boolean;
      alpha: number;
      glow: string | null;
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
        size: t.type === "bush" ? 48 : 80,
        isEntity: false,
        shadow: t.type !== "bush",
        alpha: 1,
        glow: null,
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

      ctx.save();
      ctx.globalAlpha = item.alpha;
      ctx.translate(screenX, screenY);
      if (item.rotation !== 0) {
        ctx.rotate(item.rotation);
      }
      ctx.drawImage(item.img, -item.size / 2, -item.size / 2, item.size, item.size);
      ctx.restore();
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

    // Minimap
    const mapSize = 120;
    const mapX = 10;
    const mapY = 10;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    for (const p of state.players) {
      if (!p.isAlive) continue;
      const mx = mapX + (p.x / WORLD_SIZE) * mapSize;
      const my = mapY + (p.y / WORLD_SIZE) * mapSize;
      ctx.fillStyle = p.isHunter ? "#ff6b6b" : "#5fde5f";
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const t of treesRef.current) {
      const mx = mapX + (t.x / WORLD_SIZE) * mapSize;
      const my = mapY + (t.y / WORLD_SIZE) * mapSize;
      ctx.fillStyle = t.type === "bush" ? "#4ade80" : "#a78bfa";
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

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
      const CROSSHAIR_DIST = 180;
      const crosshairWorldX = localPosRef.current.x + Math.cos(aimAngleRef.current) * CROSSHAIR_DIST;
      const crosshairWorldY = localPosRef.current.y + Math.sin(aimAngleRef.current) * CROSSHAIR_DIST;
      const mx = crosshairWorldX - camX;
      const my = crosshairWorldY - camY;
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
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
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

const fireShot = useCallback(() => {
     const state = serverStateRef.current;
     if (!state || state.phase !== "PLAYING") return;
     const me = state.players.find((p) => p.id === userId);
     if (!me || !me.isHunter || !me.isAlive) return;

     const SHOT_RANGE = 800;
     const angle = aimAngleRef.current;
     const targetX = localPosRef.current.x + Math.cos(angle) * SHOT_RANGE;
     const targetY = localPosRef.current.y + Math.sin(angle) * SHOT_RANGE;

     hunterAngleRef.current = angle + Math.PI / 2;

     const muzzleX = localPosRef.current.x + Math.cos(angle) * 40;
     const muzzleY = localPosRef.current.y + Math.sin(angle) * 40;
     muzzleFlashesRef.current.push({ x: muzzleX, y: muzzleY, life: 8 });
     hitMarkersRef.current.push({ x: targetX, y: targetY, life: 30, hit: false });

     soundManager.gunshot();

     send({
       type: "SHOOT",
       payload: { targetX, targetY },
     });
   }, [userId, send, localPosRef, aimAngleRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      canvasSizeRef.current = { w, h };
    };
    resize();
    window.addEventListener("resize", resize);

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

    // Pointer events replace TouchEvent for better multi-touch tracking
    const onPointerDown = (e: PointerEvent) => {
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isAlive) return;

      const w = window.innerWidth;
      // Animals use whole screen as joystick; hunters: left 45% = move, right 55% = aim
      const isMovementZone = !me.isHunter || e.clientX < w * 0.45;
      const isAimZone = me.isHunter && e.clientX >= w * 0.45;

      if (isMovementZone && movePointerIdRef.current === null) {
        canvas.setPointerCapture(e.pointerId);
        movePointerIdRef.current = e.pointerId;
        joystickRef.current.active = true;
        joystickRef.current.touchId = e.pointerId;
        joystickRef.current.originX = e.clientX;
        joystickRef.current.originY = e.clientY;
        joystickRef.current.dx = 0;
        joystickRef.current.dy = 0;
        setJoystickVisual({
          visible: true,
          originX: e.clientX,
          originY: e.clientY,
          knobX: e.clientX,
          knobY: e.clientY,
        });
      } else if (isAimZone && aimPointerIdRef.current === null) {
        canvas.setPointerCapture(e.pointerId);
        aimPointerIdRef.current = e.pointerId;
        const worldX = e.clientX + cameraRef.current.x;
        const worldY = e.clientY + cameraRef.current.y;
        aimRef.current.active = true;
        aimRef.current.touchId = e.pointerId;
        aimRef.current.currentX = e.clientX;
        aimRef.current.currentY = e.clientY;
        aimRef.current.worldX = worldX;
        aimRef.current.worldY = worldY;
        const aimDx = worldX - localPosRef.current.x;
        const aimDy = worldY - localPosRef.current.y;
        aimAngleRef.current = Math.atan2(aimDy, aimDx);
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
          setJoystickVisual((prev) => ({
            ...prev,
            knobX: prev.originX + Math.cos(angle) * maxDist,
            knobY: prev.originY + Math.sin(angle) * maxDist,
          }));
        } else {
          joystickRef.current.dx = dx / maxDist;
          joystickRef.current.dy = dy / maxDist;
          setJoystickVisual((prev) => ({
            ...prev,
            knobX: e.clientX,
            knobY: e.clientY,
          }));
        }
      } else if (aimPointerIdRef.current === e.pointerId) {
        const worldX = e.clientX + cameraRef.current.x;
        const worldY = e.clientY + cameraRef.current.y;
        aimRef.current.currentX = e.clientX;
        aimRef.current.currentY = e.clientY;
        aimRef.current.worldX = worldX;
        aimRef.current.worldY = worldY;
        // Smooth angle interpolation toward drag direction
        const aimDx = worldX - localPosRef.current.x;
        const aimDy = worldY - localPosRef.current.y;
        const targetAngle = Math.atan2(aimDy, aimDx);
        const diff = targetAngle - aimAngleRef.current;
        const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        aimAngleRef.current += wrapped * 0.3;
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
            left: aimVisual.x - 30,
            top: aimVisual.y - 30,
            width: 60,
            height: 60,
          }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-red-400/80 bg-red-500/10" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-red-400/80" />
          <div className="absolute top-1/2 left-0 h-px w-full bg-red-400/80" />
        </div>
      )}

      {isMobile && currentMe?.isHunter && gameState?.phase === "PLAYING" && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fireShot();
            }}
            className="w-16 h-16 rounded-full bg-red-500/80 border-2 border-red-400/80 flex items-center justify-center active:scale-95 transition select-none"
            style={{ touchAction: "manipulation" }}
          >
            <span className="text-red-200 text-2xl">🔫</span>
          </button>
        </div>
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



