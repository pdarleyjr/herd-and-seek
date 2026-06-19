import { useEffect, useRef, useCallback, useState } from "react";
import { type AssetMap } from "./AssetLoader";
import {
  type SerializedState,
  type AnimalType,
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
  wobble: number;
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

interface GameCanvasProps {
  assets: AssetMap;
  userId: string;
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

export default function GameCanvas({
  assets,
  userId,
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
  const serverStateRef = useRef<SerializedState | null>(null);
  const gameTickRef = useRef(0);
  const lastSyncRef = useRef(0);
  const perkStateRef = useRef<{ type: string; activeUntil: number }>({
    type: "none",
    activeUntil: 0,
  });
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 800, h: 600 });
  const dustParticlesRef = useRef<
    { x: number; y: number; life: number; maxLife: number }[]
  >([]);
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);
  const hitMarkersRef = useRef<HitMarker[]>([]);
  const hunterAngleRef = useRef(0);

  const [isMobile] = useState(() => isTouchDevice());

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
        wobble: 0,
      }));
      const me = gameState.players.find((p) => p.id === userId);
      if (me) localPosRef.current = { x: me.x, y: me.y };
      soundManager.gameStart();
    }

    if (treesRef.current.length === 0) {
      treesRef.current = generateTrees();
    }
  }, [gameState, userId, localPosRef]);

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

        if (npc.x <= 32 || npc.x >= WORLD_SIZE - 32) {
          npc.vx = -npc.vx;
          npc.x = Math.max(32, Math.min(WORLD_SIZE - 32, npc.x));
        }
        if (npc.y <= 32 || npc.y >= WORLD_SIZE - 32) {
          npc.vy = -npc.vy;
          npc.y = Math.max(32, Math.min(WORLD_SIZE - 32, npc.y));
        }
        npc.wobble = Math.sin(gameTickRef.current * 0.2) * 0.1;
      } else {
        npc.wobble = 0;
      }
    }
  }, []);

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
    const isSprinting =
      perkStateRef.current.type === "sprint" &&
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

    let speed = me.isHunter ? HUNTER_SPEED : ANIMAL_SPEED;
    if (isSprinting) speed *= 1.5;

    localPosRef.current.x += dx * speed;
    localPosRef.current.y += dy * speed;

    localPosRef.current.x = Math.max(
      32,
      Math.min(WORLD_SIZE - 32, localPosRef.current.x)
    );
    localPosRef.current.y = Math.max(
      32,
      Math.min(WORLD_SIZE - 32, localPosRef.current.y)
    );

    if (me.isHunter) {
      const aimDx = mouseRef.current.worldX - localPosRef.current.x;
      const aimDy = mouseRef.current.worldY - localPosRef.current.y;
      hunterAngleRef.current = Math.atan2(aimDy, aimDx) + Math.PI / 2;
    } else if (dx !== 0 || dy !== 0) {
      hunterAngleRef.current = Math.atan2(dy, dx) + Math.PI / 2;
    }

    if (isSprinting && (dx !== 0 || dy !== 0)) {
      if (Math.random() < 0.3) {
        dustParticlesRef.current.push({
          x: localPosRef.current.x,
          y: localPosRef.current.y + 10,
          life: 30,
          maxLife: 30,
        });
      }
    }

    const now = Date.now();
    if (now - lastSyncRef.current > 1000 / 30) {
      lastSyncRef.current = now;
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
    grd.addColorStop(1, "#3a6c2a");
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

    ctx.strokeStyle = "#2a4c1a";
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

    interface RenderItem {
      x: number;
      y: number;
      img: HTMLImageElement;
      wobble: number;
      rotation: number;
      size: number;
      isEntity: boolean;
      shadow: boolean;
    }
    const renderArray: RenderItem[] = [];

    for (const npc of npcsRef.current) {
      renderArray.push({
        x: npc.x,
        y: npc.y,
        img: getAnimalImage(assets, npc.animalType),
        wobble: npc.wobble,
        rotation: 0,
        size: 64,
        isEntity: true,
        shadow: true,
      });
    }

    for (const p of state.players) {
      if (!p.isAlive) continue;
      const img = p.isHunter
        ? assets.hunter
        : getAnimalImage(assets, p.animalType);
      const isLocal = p.id === userId;
      const px = isLocal ? localPosRef.current.x : p.x;
      const py = isLocal ? localPosRef.current.y : p.y;

      let wobble = 0;
      let rotation = 0;

      if (p.isHunter) {
        if (isLocal) {
          rotation = hunterAngleRef.current;
        } else {
          rotation = hunterAngleRef.current;
        }
      } else {
        wobble = Math.sin(gameTickRef.current * 0.2 + (isLocal ? 0 : p.x * 0.01)) * 0.1;
      }

      renderArray.push({
        x: px,
        y: py,
        img,
        wobble,
        rotation,
        size: 64,
        isEntity: true,
        shadow: true,
      });
    }

    for (const t of treesRef.current) {
      const img =
        t.type === "bush" ? assets.bush : t.type === "brown" ? assets.treeBrown : assets.tree;
      renderArray.push({
        x: t.x,
        y: t.y,
        img,
        wobble: 0,
        rotation: 0,
        size: t.type === "bush" ? 48 : 80,
        isEntity: false,
        shadow: t.type !== "bush",
      });
    }

    renderArray.sort((a, b) => a.y - b.y);

    for (const item of renderArray) {
      const screenX = item.x - camX;
      const screenY = item.y - camY;

      if (
        screenX < -120 ||
        screenX > w + 120 ||
        screenY < -120 ||
        screenY > h + 120
      )
        continue;

      if (item.shadow) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + item.size * 0.35, item.size * 0.4, item.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      if (item.rotation !== 0) {
        ctx.rotate(item.rotation);
      } else if (item.wobble !== 0) {
        ctx.rotate(item.wobble);
      }
      ctx.drawImage(item.img, -item.size / 2, -item.size / 2, item.size, item.size);
      ctx.restore();
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
      const mx = mouseRef.current.worldX - camX;
      const my = mouseRef.current.worldY - camY;
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
  }, [assets, userId, localPosRef]);

  const gameLoop = useCallback(() => {
    updateNpcs();
    updateLocalPlayer();
    render();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [updateNpcs, updateLocalPlayer, render]);

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
      if (!me || me.isHunter) return;

      if (key === "shift" && me.perk === "sprint") {
        perkStateRef.current = {
          type: "sprint",
          activeUntil: Date.now() + 1500,
        };
      }
      if (key === "f" && me.perk === "camouflage") {
        perkStateRef.current = {
          type: "camouflage",
          activeUntil: Date.now() + 3000,
        };
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

    const fireShot = (targetWorldX: number, targetWorldY: number) => {
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isHunter || !me.isAlive) return;

      const aimDx = targetWorldX - localPosRef.current.x;
      const aimDy = targetWorldY - localPosRef.current.y;
      hunterAngleRef.current = Math.atan2(aimDy, aimDx) + Math.PI / 2;

      const muzzleX = localPosRef.current.x + Math.cos(Math.atan2(aimDy, aimDx)) * 40;
      const muzzleY = localPosRef.current.y + Math.sin(Math.atan2(aimDy, aimDx)) * 40;
      muzzleFlashesRef.current.push({ x: muzzleX, y: muzzleY, life: 8 });
      hitMarkersRef.current.push({ x: targetWorldX, y: targetWorldY, life: 30, hit: false });

      soundManager.gunshot();

      send({
        type: "SHOOT",
        payload: { targetX: targetWorldX, targetY: targetWorldY },
      });
    };

    const onClick = () => {
      fireShot(mouseRef.current.worldX, mouseRef.current.worldY);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isAlive) return;

      const touch = e.changedTouches[0];
      const touchX = touch.clientX;
      const touchY = touch.clientY;

      const isHunter = me.isHunter;
      const w = window.innerWidth;
      const rightHalf = touchX > w / 2;

      if (isHunter && rightHalf) {
        const worldX = touchX + cameraRef.current.x;
        const worldY = touchY + cameraRef.current.y;
        mouseRef.current.x = touchX;
        mouseRef.current.y = touchY;
        mouseRef.current.worldX = worldX;
        mouseRef.current.worldY = worldY;
        fireShot(worldX, worldY);
      } else if (!joystickRef.current.active) {
        joystickRef.current.active = true;
        joystickRef.current.touchId = touch.identifier;
        joystickRef.current.originX = touchX;
        joystickRef.current.originY = touchY;
        joystickRef.current.dx = 0;
        joystickRef.current.dy = 0;
        setJoystickVisual({
          visible: true,
          originX: touchX,
          originY: touchY,
          knobX: touchX,
          knobY: touchY,
        });
      } else if (isHunter) {
        mouseRef.current.x = touchX;
        mouseRef.current.y = touchY;
        mouseRef.current.worldX = touchX + cameraRef.current.x;
        mouseRef.current.worldY = touchY + cameraRef.current.y;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isAlive) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (
          joystickRef.current.active &&
          touch.identifier === joystickRef.current.touchId
        ) {
          const dx = touch.clientX - joystickRef.current.originX;
          const dy = touch.clientY - joystickRef.current.originY;
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
              knobX: touch.clientX,
              knobY: touch.clientY,
            }));
          }
        } else if (me.isHunter) {
          mouseRef.current.x = touch.clientX;
          mouseRef.current.y = touch.clientY;
          mouseRef.current.worldX = touch.clientX + cameraRef.current.x;
          mouseRef.current.worldY = touch.clientY + cameraRef.current.y;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickRef.current.touchId) {
          joystickRef.current.active = false;
          joystickRef.current.touchId = null;
          joystickRef.current.dx = 0;
          joystickRef.current.dy = 0;
          setJoystickVisual({ visible: false, originX: 0, originY: 0, knobX: 0, knobY: 0 });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop, userId, send]);

  const currentMe = gameState?.players.find((p) => p.id === userId);
  const canUsePerk =
    currentMe && !currentMe.isHunter && currentMe.isAlive && currentMe.perk !== "none";

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 touch-none"
        style={{ touchAction: "none" }}
      />

      {isMobile && joystickVisual.visible && (
        <div className="absolute z-5 pointer-events-none">
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

      {isMobile && canUsePerk && gameState?.phase === "PLAYING" && (
        <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-3">
          {currentMe?.perk === "sprint" && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (currentMe.perk === "sprint") {
                  perkStateRef.current = {
                    type: "sprint",
                    activeUntil: Date.now() + 1500,
                  };
                }
              }}
              className="w-16 h-16 rounded-full bg-blue-500/80 border-2 border-white/50 text-white text-2xl flex items-center justify-center active:scale-90 transition-transform select-none"
            >
              💨
            </button>
          )}
          {currentMe?.perk === "camouflage" && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (currentMe.perk === "camouflage") {
                  perkStateRef.current = {
                    type: "camouflage",
                    activeUntil: Date.now() + 3000,
                  };
                }
              }}
              className="w-16 h-16 rounded-full bg-purple-500/80 border-2 border-white/50 text-white text-2xl flex items-center justify-center active:scale-90 transition-transform select-none"
            >
              🫥
            </button>
          )}
        </div>
      )}
    </>
  );
}
