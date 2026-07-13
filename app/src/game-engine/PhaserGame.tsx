import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import type { ClientMessage, DecoySpawnPayload, PerkType, SerializedState } from "../types";
import { GameBridge } from "./GameBridge";
import { createGameConfig } from "./gameConfig";
import type { GameSceneVariant } from "./scenes/PreloadScene";
import type { QualityTier } from "./types";
import { gameAudio } from "./systems/AudioSystem";
import AudioControls from "../components/AudioControls";
import "./game.css";

export interface PhaserGameProps {
  variant?: GameSceneVariant;
  userId: string;
  username: string;
  gameState: SerializedState | null;
  localPosRef: { current: { x: number; y: number } };
  send: (message: ClientMessage) => void;
  selectedAnimal?: string;
  selectedLevel?: string;
  selectedPerk?: PerkType;
  decoySpawn?: (DecoySpawnPayload & { receivedAt: number }) | null;
  className?: string;
}

export default function PhaserGame({
  variant = "match",
  userId,
  username,
  gameState,
  localPosRef,
  send,
  selectedAnimal,
  selectedLevel,
  selectedPerk,
  decoySpawn,
  className = "",
}: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [bridge] = useState(() => new GameBridge({ userId, username, send, localPosition: localPosRef }));
  const [quality, setQuality] = useState<QualityTier>("balanced");

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = new Phaser.Game(createGameConfig(hostRef.current, bridge, variant));
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [bridge, variant]);

  useEffect(() => {
    bridge.updateRuntime({ userId, username, send, localPosition: localPosRef });
  }, [bridge, localPosRef, send, userId, username]);

  useEffect(() => bridge.setState(gameState), [bridge, gameState]);
  useEffect(() => bridge.events.on("SHOOT", () => gameAudio.shot()), [bridge]);
  useEffect(() => bridge.events.on("PERK_ACTIVATE", () => gameAudio.perk()), [bridge]);
  useEffect(() => { if (decoySpawn) bridge.events.emit("DECOY_SPAWN", decoySpawn); }, [bridge, decoySpawn]);
  useEffect(() => bridge.events.on("LOCAL_MOVE", ({ x, y, sequence }) => {
    if (!shellRef.current) return;
    shellRef.current.dataset.localX = x.toFixed(2);
    shellRef.current.dataset.localY = y.toFixed(2);
    shellRef.current.dataset.localSequence = String(sequence);
  }), [bridge]);
  useEffect(() => {
    let detachAudio = () => {};
    const unsubscribe = bridge.events.on("SCENE_READY", ({ key }) => {
      if (shellRef.current) shellRef.current.dataset.engineReady = key;
      detachAudio();
      const scene = gameRef.current?.scene.getScene(key);
      if (!scene) return;
      const onCue = (cue: { kind: string; intensity: number }) => {
        const surface = cue.kind === "water-splash" ? "water" : cue.kind === "footstep-rock" ? "rock" : cue.kind === "footstep-dirt" ? "sand" : cue.kind === "npc-rustle" ? "forest" : "grass";
        gameAudio.footstep(surface, cue.intensity);
      };
      scene.events.on("environment-audio-cue", onCue);
      detachAudio = () => scene.events.off("environment-audio-cue", onCue);
    });
    return () => { detachAudio(); unsubscribe(); };
  }, [bridge]);
  useEffect(() => bridge.events.on("PLAYER_FEEDBACK", ({ kind, message }) => {
    if (!shellRef.current) return;
    shellRef.current.dataset.feedbackKind = kind;
    shellRef.current.dataset.feedback = message;
  }), [bridge]);
  useEffect(() => bridge.events.on("FPS_UPDATE", ({ fps }) => {
    if (shellRef.current) shellRef.current.dataset.fps = fps.toFixed(1);
  }), [bridge]);
  useEffect(() => {
    const publishSelection = () => {
      if (selectedAnimal) bridge.events.emit("SELECTED_ANIMAL", { animalType: selectedAnimal as never });
      if (selectedLevel) bridge.events.emit("SELECTED_LEVEL", { levelId: selectedLevel as never });
      if (selectedPerk) bridge.events.emit("SELECTED_PERK", { perk: selectedPerk });
    };
    publishSelection();
    const unsubscribe = bridge.events.on("SCENE_READY", publishSelection);
    return unsubscribe;
  }, [bridge, selectedAnimal, selectedLevel, selectedPerk]);

  const localPlayer = useMemo(() => gameState?.players.find((player) => player.id === userId), [gameState, userId]);
  const canAct = Boolean(localPlayer?.isAlive && !localPlayer.isHunter && (localPlayer.perk === "sprint" || localPlayer.perk === "camouflage" || localPlayer.perk === "decoy"));

  return (
    <div ref={shellRef} className={`phaser-shell ${className}`} data-renderer="phaser" data-scene={variant} data-phase={gameState?.phase ?? "LOADING"}
      data-perk={localPlayer?.perk ?? "none"} data-perk-active-until={localPlayer?.perkActiveUntil ?? 0}
      data-perk-cooldown-until={localPlayer?.perkCooldownUntil ?? 0} data-perk-consumed={localPlayer?.perkConsumed ? "true" : "false"}
      data-extra-life-used={localPlayer?.extraLifeUsed ? "true" : "false"}
      data-decoy-owner={decoySpawn?.ownerId ?? ""}>
      <div ref={hostRef} className="phaser-host" aria-label={`${variant} game world`} />
      {variant === "match" && (
        <div className="game-control-layer" aria-label="Gameplay controls">
          <div className="touch-joystick-guide" aria-hidden="true"><span /></div>
          {localPlayer?.isHunter && (
            <button className="game-action game-action--fire" type="button" aria-label="Fire at reticle"
              onPointerDown={(event) => { event.preventDefault(); bridge.events.emit("SHOOT", { targetX: localPosRef.current.x + 120, targetY: localPosRef.current.y }); }}>
              <span className="game-action__glyph" aria-hidden="true">◎</span><span>Fire</span>
            </button>
          )}
          {canAct && (
            <button className="game-action game-action--perk" type="button" aria-label={`Activate ${localPlayer?.perk}`}
              onPointerDown={(event) => { event.preventDefault(); bridge.events.emit("PERK_ACTIVATE", { perk: localPlayer!.perk }); }}>
              <span className="game-action__glyph" aria-hidden="true">✦</span><span>Perk</span>
            </button>
          )}
        </div>
      )}
      {variant === "match" && (
        <AudioControls compact className="audio-picker" />
      )}
      {variant === "match" && (
        <label className="quality-picker">
          <span>Graphics</span>
          <select value={quality} onChange={(event) => { const tier = event.target.value as QualityTier; setQuality(tier); bridge.setQuality(tier); }}>
            <option value="high">High</option>
            <option value="balanced">Balanced</option>
            <option value="battery">Battery saver</option>
          </select>
        </label>
      )}
    </div>
  );
}
