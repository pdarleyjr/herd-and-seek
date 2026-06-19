import { useEffect, useRef, useCallback } from "react";
import { type AssetMap } from "./AssetLoader";
import {
  type SerializedState,
  type AnimalType,
  type ClientMessage,
  WORLD_SIZE,
  ANIMAL_SPEED,
  HUNTER_SPEED,
} from "./types";

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

interface GameCanvasProps {
  assets: AssetMap;
  userId: string;
  username: string;
  host: string;
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
      dx /= len;
      dy /= len;
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
  }, [userId, send, localPosRef]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = canvasSizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#4a7c3a";
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

    ctx.strokeStyle = "#3a5c2a";
    ctx.lineWidth = 8;
    ctx.strokeRect(-camX, -camY, WORLD_SIZE, WORLD_SIZE);

    interface RenderItem {
      x: number;
      y: number;
      img: HTMLImageElement;
      wobble: number;
      size: number;
    }
    const renderArray: RenderItem[] = [];

    for (const npc of npcsRef.current) {
      renderArray.push({
        x: npc.x,
        y: npc.y,
        img: getAnimalImage(assets, npc.animalType),
        wobble: npc.wobble,
        size: 64,
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
      if (!p.isHunter) {
        wobble = Math.sin(gameTickRef.current * 0.2 + (isLocal ? 0 : p.x * 0.01)) * 0.1;
      }

      renderArray.push({
        x: px,
        y: py,
        img,
        wobble,
        size: 64,
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
        size: t.type === "bush" ? 48 : 80,
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

      ctx.save();
      ctx.translate(screenX, screenY);
      if (item.wobble !== 0) {
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

    if (me && me.isHunter && me.isAlive) {
      const mx = mouseRef.current.worldX - camX;
      const my = mouseRef.current.worldY - camY;
      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 12, my);
      ctx.lineTo(mx + 12, my);
      ctx.moveTo(mx, my - 12);
      ctx.lineTo(mx, my + 12);
      ctx.stroke();
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

    const onClick = () => {
      const state = serverStateRef.current;
      if (!state || state.phase !== "PLAYING") return;
      const me = state.players.find((p) => p.id === userId);
      if (!me || !me.isHunter || !me.isAlive) return;

      send({
        type: "SHOOT",
        payload: {
          targetX: mouseRef.current.worldX,
          targetY: mouseRef.current.worldY,
        },
      });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop, userId, send]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 cursor-crosshair"
    />
  );
}
