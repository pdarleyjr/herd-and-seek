import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { OpenWorldBridge } from "../game-engine/OpenWorldBridge";
import { OpenWorldScene } from "../game-engine/scenes/OpenWorldScene";
import type { ContextAction } from "./openWorldControls";
import type { OpenWorldProfile, OpenWorldZoneState, QuestId, QuestProgress } from "./openWorldTypes";
import { gameAudio } from "../game-engine/systems/AudioSystem";
import TouchJoystick from "../components/TouchJoystick";
import { useControlSettings } from "../components/useControlSettings";

interface OpenWorldPhaserProps {
  userId: string;
  username: string;
  animalType: string;
  zoneState: OpenWorldZoneState | null;
  profile: OpenWorldProfile | null;
  questProgress: Record<string, QuestProgress>;
  onSync: (x: number, y: number, animalType?: string) => void;
  onCollectNode: (nodeId: string) => void;
  onAcceptQuest: (questId: QuestId) => void;
  onClaimQuest: (questId: QuestId) => void;
}

export default function OpenWorldPhaser(props: OpenWorldPhaserProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [prompt, setPrompt] = useState<ContextAction | null>(null);
  const [bridge] = useState(() => new OpenWorldBridge(runtimeFrom(props)));
  const controlSettings = useControlSettings();

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: hostRef.current,
      width: hostRef.current.clientWidth || 1280,
      height: hostRef.current.clientHeight || 720,
      backgroundColor: "#cba45c",
      antialias: true,
      render: { powerPreference: "high-performance", antialias: true },
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: "100%", height: "100%" },
      scene: [new OpenWorldScene(bridge)],
      fps: { target: 60, min: 30, smoothStep: true },
    });
    return () => { gameRef.current?.destroy(true); gameRef.current = null; };
  }, [bridge]);

  useEffect(() => bridge.onPrompt(setPrompt), [bridge]);
  useEffect(() => {
    let detachAudio = () => {};
    const unsubscribe = bridge.onReady((key) => {
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
  useEffect(() => bridge.onPosition(({ x, y }) => {
    if (!shellRef.current) return;
    shellRef.current.dataset.localX = x.toFixed(2);
    shellRef.current.dataset.localY = y.toFixed(2);
  }), [bridge]);
  useEffect(() => { bridge.updateRuntime(runtimeFrom(props)); }, [bridge, props]);
  useEffect(() => { bridge.setSnapshot({ zoneState: props.zoneState, profile: props.profile, questProgress: props.questProgress }); }, [bridge, props.zoneState, props.profile, props.questProgress]);

  return (
    <div ref={shellRef} className="open-world-phaser" data-renderer="phaser" data-scene="openWorld" data-handedness={controlSettings.handedness}
      data-zone-ready={props.zoneState ? "true" : "false"} data-player-count={props.zoneState?.players.length ?? 0}
      data-collectible-count={props.zoneState?.collectibles.length ?? 0} data-action-kind={prompt?.kind ?? "none"}
      data-coins={props.profile?.coins ?? 0}
      data-active-quests={Object.values(props.questProgress).filter((quest) => quest.status === "active").length}
      data-complete-quests={Object.values(props.questProgress).filter((quest) => quest.status === "complete").length}
      data-claimed-quests={Object.values(props.questProgress).filter((quest) => quest.status === "claimed").length}>
      <div ref={hostRef} className="open-world-phaser__host" aria-label="Grand Reserve seamless open world" />
      <TouchJoystick settings={controlSettings} onMove={(x, y) => bridge.setJoystick(x, y)} className="open-world-phaser__touch-control" />
      {prompt && (
        <button type="button" className="game-button game-button--primary open-world-phaser__action" onClick={() => bridge.triggerAction()} aria-label={prompt.label}>
          <span aria-hidden="true">✦</span>{prompt.label}
        </button>
      )}
      <div className="open-world-phaser__hint" aria-live="polite">WASD, arrows, joystick, or tap the trail to move</div>
    </div>
  );
}

function runtimeFrom(props: OpenWorldPhaserProps) {
  return {
    userId: props.userId,
    username: props.username,
    animalType: props.animalType,
    onSync: props.onSync,
    onCollectNode: props.onCollectNode,
    onAcceptQuest: props.onAcceptQuest,
    onClaimQuest: props.onClaimQuest,
  };
}
