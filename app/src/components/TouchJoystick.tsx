import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { ControlSettings } from "../game-engine/systems/ControlSettings";

interface TouchJoystickProps {
  settings: ControlSettings;
  onMove: (x: number, y: number) => void;
  className?: string;
}

export default function TouchJoystick({ settings, onMove, className = "" }: TouchJoystickProps) {
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = 48 * settings.scale;

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  useEffect(() => {
    const resetWhenHidden = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    window.addEventListener("orientationchange", release);
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("orientationchange", release);
      document.removeEventListener("visibilitychange", resetWhenHidden);
    };
  });

  const move = (clientX: number, clientY: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const distance = Math.hypot(dx, dy);
    const magnitude = Math.min(distance, radius);
    const x = distance > 0 ? dx / distance * magnitude : 0;
    const y = distance > 0 ? dy / distance * magnitude : 0;
    setKnob({ x, y });
    onMove(x / radius, y / radius);
  };
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    const rect = root.current!.getBoundingClientRect();
    origin.current = settings.joystick === "fixed"
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    move(event.clientX, event.clientY);
  };
  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current === event.pointerId) move(event.clientX, event.clientY);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current === event.pointerId) release();
  };

  const style = {
    "--control-scale": settings.scale,
    "--control-opacity": settings.opacity,
  } as CSSProperties;
  return (
    <div ref={root} className={`touch-joystick ${className}`} data-handedness={settings.handedness} style={style}
      role="group" aria-label="Movement joystick" onPointerDown={start} onPointerMove={drag}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
