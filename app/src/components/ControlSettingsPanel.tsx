import { useState } from "react";
import {
  writeControlSettings,
  type ControlSettings,
} from "../game-engine/systems/ControlSettings";
import { useControlSettings } from "./useControlSettings";
import "./controlSettings.css";

export default function ControlSettingsPanel({ className = "" }: { className?: string }) {
  const settings = useControlSettings();
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<ControlSettings>) => writeControlSettings({ ...settings, ...patch });

  return (
    <>
      <button type="button" className={`control-settings-trigger ${className}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        Controls
      </button>
      {open && (
        <div className="control-settings-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="control-settings-panel" role="dialog" aria-modal="true" aria-labelledby="control-settings-title">
            <header>
              <div><small>Tablet & desktop</small><h2 id="control-settings-title">Control layout</h2></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close control settings">Close</button>
            </header>
            <fieldset>
              <legend>Handedness</legend>
              <div className="control-settings-options">
                {(["right", "left"] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={settings.handedness === value} onClick={() => update({ handedness: value })}>
                    <strong>{value === "right" ? "Right-handed" : "Left-handed"}</strong>
                    <span>{value === "right" ? "Move left · act right" : "Act left · move right"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Joystick</legend>
              <div className="control-settings-options">
                {(["fixed", "floating"] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={settings.joystick === value} onClick={() => update({ joystick: value })}>
                    <strong>{value === "fixed" ? "Fixed center" : "Floating start"}</strong>
                    <span>{value === "fixed" ? "Predictable muscle memory" : "Starts where your thumb lands"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label>Control size <output>{Math.round(settings.scale * 100)}%</output>
              <input type="range" min="0.8" max="1.35" step="0.05" value={settings.scale} onChange={(event) => update({ scale: Number(event.target.value) })} />
            </label>
            <label>Control opacity <output>{Math.round(settings.opacity * 100)}%</output>
              <input type="range" min="0.45" max="1" step="0.05" value={settings.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} />
            </label>
            <p>Keyboard: WASD or arrows. Gamepad: left stick, A for action, right trigger to fire.</p>
          </section>
        </div>
      )}
    </>
  );
}
