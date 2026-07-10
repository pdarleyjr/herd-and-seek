import { useEffect, useRef } from "react";
import { drawAnimal } from "../open-world/animalArt";
import { ANIMAL_DEFS, type AnimalType } from "../types";

interface AnimalThumbProps {
  animal: AnimalType;
  size?: number;
  className?: string;
  /** Animate idle bob/walk (uses rAF). */
  animated?: boolean;
  facing?: 1 | -1;
  isLocal?: boolean;
}

/**
 * Canvas-rendered character preview. Replaces direct `/assets/<animal>.png`
 * requests and emoji discs with consistent procedural art used across the app.
 */
export default function AnimalThumb({ animal, size = 96, className, animated = false, facing = 1, isLocal = false }: AnimalThumbProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const def = ANIMAL_DEFS[animal];
    let raf = 0;
    const start = performance.now();

    const paint = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      drawAnimal(ctx, size / 2, size / 2, size * 0.82, animal, facing, (now - start) / 1000, animated ? (now - start) / 220 : 0, isLocal, def?.color);
      if (animated) raf = requestAnimationFrame(paint);
    };

    if (animated) {
      raf = requestAnimationFrame(paint);
    } else {
      paint(start);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [animal, size, animated, facing, isLocal]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-label={ANIMAL_DEFS[animal]?.label ?? animal} role="img" />;
}
