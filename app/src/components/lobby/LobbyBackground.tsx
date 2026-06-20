import { useEffect, useRef } from "react";

export default function LobbyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame = 0;
    let tick = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drawGrass = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;

      // Wave the grass blades gently
      const bladeCount = Math.floor(w / 18);
      for (let i = 0; i < bladeCount; i++) {
        const bx = (i / bladeCount) * w;
        const sway = Math.sin(t * 0.04 + i * 0.6) * 4;
        const height = 28 + Math.sin(i * 1.3) * 8;
        const shade = 0.7 + Math.random() * 0.3;
        ctx.strokeStyle = `rgba(${Math.floor(40 * shade)},${Math.floor(160 * shade)},${Math.floor(30 * shade)},0.9)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx, h - 60);
        ctx.quadraticCurveTo(bx + sway, h - 60 - height * 0.5, bx + sway * 1.4, h - 60 - height);
        ctx.stroke();
      }
    };

    const draw = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      sky.addColorStop(0, "#1a78c8");
      sky.addColorStop(0.55, "#7ecef4");
      sky.addColorStop(1, "#c8e8f8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.65);

      // Sun glow
      const sunX = w * 0.5;
      const sunY = h * 0.13;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 130);
      sunGlow.addColorStop(0, "rgba(255,245,150,0.95)");
      sunGlow.addColorStop(0.35, "rgba(255,220,60,0.7)");
      sunGlow.addColorStop(0.65, "rgba(255,200,0,0.3)");
      sunGlow.addColorStop(1, "rgba(255,180,0,0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
      ctx.fill();

      // Sun disc
      const sunDisc = ctx.createRadialGradient(sunX - 8, sunY - 8, 4, sunX, sunY, 42);
      sunDisc.addColorStop(0, "#fffde0");
      sunDisc.addColorStop(0.5, "#ffe050");
      sunDisc.addColorStop(1, "#ffb800");
      ctx.fillStyle = sunDisc;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
      ctx.fill();

      // Clouds (drifting slowly)
      const cloudOffset = (tick * 0.15) % (w * 1.5);
      const drawCloud = (cx: number, cy: number, scale: number, alpha: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#f0f8ff";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(200,230,255,0.8)";
        const puffs: [number, number, number][] = [
          [cx, cy, 38 * scale],
          [cx + 44 * scale, cy - 8 * scale, 30 * scale],
          [cx - 44 * scale, cy - 4 * scale, 26 * scale],
          [cx + 22 * scale, cy - 20 * scale, 26 * scale],
          [cx - 22 * scale, cy - 16 * scale, 22 * scale],
        ];
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      drawCloud(w * 0.15 + cloudOffset * 0.3 - w * 0.2, h * 0.15, 1.1, 0.88);
      drawCloud(w * 0.65 + cloudOffset * 0.2 - w * 0.1, h * 0.1, 0.85, 0.75);
      drawCloud(w * 0.82 + cloudOffset * 0.35 - w * 0.15, h * 0.2, 0.65, 0.65);

      // Distant savanna horizon
      const horizon = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.68);
      horizon.addColorStop(0, "rgba(200,230,120,0.5)");
      horizon.addColorStop(1, "rgba(100,180,40,0)");
      ctx.fillStyle = horizon;
      ctx.fillRect(0, h * 0.55, w, h * 0.15);

      // Ground / grass base
      const ground = ctx.createLinearGradient(0, h * 0.6, 0, h);
      ground.addColorStop(0, "#4a9e28");
      ground.addColorStop(0.3, "#3a8820");
      ground.addColorStop(0.7, "#2d7018");
      ground.addColorStop(1, "#1f5010");
      ctx.fillStyle = ground;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62);
      ctx.bezierCurveTo(w * 0.25, h * 0.58, w * 0.75, h * 0.65, w, h * 0.60);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Foreground grass blades
      drawGrass(tick);

      // Foreground ground strip
      const fgGround = ctx.createLinearGradient(0, h * 0.88, 0, h);
      fgGround.addColorStop(0, "#228b22");
      fgGround.addColorStop(1, "#155210");
      ctx.fillStyle = fgGround;
      ctx.fillRect(0, h * 0.88, w, h * 0.12);
    };

    const loop = () => {
      draw();
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
