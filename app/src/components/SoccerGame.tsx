import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { createLocalSoccerBridge, createNetworkSoccerBridge } from "../game-engine/soccer";
import { SoccerScene } from "../game-engine/scenes/SoccerScene";
import AudioControls from "./AudioControls";
import ControlSettingsPanel from "./ControlSettingsPanel";
import { useControlSettings } from "./useControlSettings";
import TouchJoystick from "./TouchJoystick";
import type { SoccerSetupSelection } from "./SoccerSetup";
import "./soccerGame.css";
import "./soccerGameEnhancements.css";

interface SoccerGameProps {
  userId: string;
  username: string;
  selection: SoccerSetupSelection;
  onExit: () => void;
  network?: { roomId: string; accessToken?: string };
}

export default function SoccerGame({ userId, username, selection, onExit, network }: SoccerGameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [bridge] = useState(() => network
    ? createNetworkSoccerBridge({ roomId: network.roomId, userId, username, team: selection.team, teamSize: selection.teamSize, accessToken: network.accessToken })
    : createLocalSoccerBridge({ localPlayerId: userId, localPlayerName: username, selectedTeam: selection.team, teamSize: selection.teamSize }));
  const controlSettings = useControlSettings();

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: hostRef.current,
      width: hostRef.current.clientWidth || 1280,
      height: hostRef.current.clientHeight || 720,
      backgroundColor: "#174b62",
      antialias: true,
      render: { antialias: true, powerPreference: "high-performance" },
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: "100%", height: "100%" },
      scene: [new SoccerScene(bridge)],
      fps: { target: 60, min: 30, smoothStep: true },
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [bridge]);

  return (
    <main className="soccer-game" data-team={selection.team} data-format={selection.format} data-handedness={controlSettings.handedness}>
      <div ref={hostRef} className="soccer-game__host" aria-label="Herd and Seek Field League soccer match" />
      <div className="soccer-game__top-actions">
        <button type="button" onClick={onExit} className="soccer-game__exit">Exit field</button>
        <AudioControls compact />
        <ControlSettingsPanel />
      </div>
      <TouchJoystick settings={controlSettings} onMove={(x, y) => window.dispatchEvent(new CustomEvent("hs-soccer-control", { detail: { x, y } }))} />
      <button type="button" className="soccer-game__kick" onPointerDown={(event) => { event.preventDefault(); window.dispatchEvent(new Event("hs-soccer-kick")); }}>Kick</button>
      {network && (
        <div className="soccer-game__crew-note" role="status">Crew Match · {network.roomId} · open positions use AI</div>
      )}
    </main>
  );
}
