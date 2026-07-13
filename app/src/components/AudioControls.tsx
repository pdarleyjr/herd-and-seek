import { useEffect, useState } from "react";
import { soundManager } from "../SoundManager";
import "./audioControls.css";

interface AudioControlsProps {
  compact?: boolean;
  className?: string;
}

export default function AudioControls({ compact = false, className = "" }: AudioControlsProps) {
  const [settings, setSettings] = useState(() => soundManager.settings());

  useEffect(() => soundManager.subscribe(setSettings), []);

  const toggleMusic = () => {
    soundManager.unlock();
    soundManager.setMusicEnabled(settings.musicMuted);
    setSettings(soundManager.settings());
  };

  const toggleEffects = () => {
    soundManager.unlock();
    soundManager.setEffectsEnabled(settings.effectsMuted);
    soundManager.uiConfirm();
    setSettings(soundManager.settings());
  };

  return (
    <div className={`audio-controls ${compact ? "audio-controls--compact" : ""} ${className}`.trim()} aria-label="Audio settings">
      <button type="button" className={settings.musicMuted ? "is-muted" : ""} onClick={toggleMusic}
        aria-pressed={!settings.musicMuted} aria-label={settings.musicMuted ? "Turn music on" : "Turn music off"}>
        <MusicIcon muted={settings.musicMuted} /><span>Music</span><b>{settings.musicMuted ? "Off" : "On"}</b>
      </button>
      <button type="button" className={settings.effectsMuted ? "is-muted" : ""} onClick={toggleEffects}
        aria-pressed={!settings.effectsMuted} aria-label={settings.effectsMuted ? "Turn sound effects on" : "Turn sound effects off"}>
        <SpeakerIcon muted={settings.effectsMuted} /><span>SFX</span><b>{settings.effectsMuted ? "Off" : "On"}</b>
      </button>
      {!compact && (
        <div className="audio-controls__levels">
          <label><span>Music volume</span><input type="range" min="0" max="1" step="0.05" value={settings.music}
            onChange={(event) => soundManager.setMusicVolume(Number(event.target.value))} /></label>
          <label><span>Effects volume</span><input type="range" min="0" max="1" step="0.05" value={settings.effects}
            onChange={(event) => soundManager.setEffectsVolume(Number(event.target.value))} /></label>
        </div>
      )}
    </div>
  );
}

function MusicIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />{muted && <path d="M4 4l16 16" />}</svg>;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9H5z" />{muted ? <path d="M18 9l4 4m0-4-4 4" /> : <path d="M17 9c1.6 1.5 1.6 4.5 0 6m2-9c3.2 3 3.2 9 0 12" />}</svg>;
}
