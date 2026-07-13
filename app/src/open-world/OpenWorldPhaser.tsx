import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { OpenWorldBridge } from "../game-engine/OpenWorldBridge";
import { OpenWorldScene } from "../game-engine/scenes/OpenWorldScene";
import type { ContextAction } from "./openWorldControls";
import type { OpenWorldProfile, OpenWorldZoneState, QuestId, QuestProgress } from "./openWorldTypes";

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
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
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
  useEffect(() => bridge.onReady((key) => { if (shellRef.current) shellRef.current.dataset.engineReady = key; }), [bridge]);
  useEffect(() => bridge.onPosition(({ x, y }) => {
    if (!shellRef.current) return;
    shellRef.current.dataset.localX = x.toFixed(2);
    shellRef.current.dataset.localY = y.toFixed(2);
  }), [bridge]);
  useEffect(() => { bridge.updateRuntime(runtimeFrom(props)); }, [bridge, props]);
  useEffect(() => { bridge.setSnapshot({ zoneState: props.zoneState, profile: props.profile, questProgress: props.questProgress }); }, [bridge, props.zoneState, props.profile, props.questProgress]);

  const moveJoystick = (clientX: number, clientY: number) => {
    if (!joystickOrigin.current) return;
    const dx = clientX - joystickOrigin.current.x;
    const dy = clientY - joystickOrigin.current.y;
    const distance = Math.hypot(dx, dy);
    const magnitude = Math.min(distance, 52);
    const x = distance ? dx / distance * magnitude : 0;
    const y = distance ? dy / distance * magnitude : 0;
    setKnob({ x, y });
    bridge.setJoystick(x / 52, y / 52);
  };
  const releaseJoystick = () => { joystickOrigin.current = null; setKnob({ x: 0, y: 0 }); bridge.setJoystick(0, 0); };

  return (
    <div ref={shellRef} className="open-world-phaser" data-renderer="phaser" data-scene="openWorld"
      data-zone-ready={props.zoneState ? "true" : "false"} data-player-count={props.zoneState?.players.length ?? 0}
      data-collectible-count={props.zoneState?.collectibles.length ?? 0} data-action-kind={prompt?.kind ?? "none"}
      data-coins={props.profile?.coins ?? 0}
      data-active-quests={Object.values(props.questProgress).filter((quest) => quest.status === "active").length}
      data-complete-quests={Object.values(props.questProgress).filter((quest) => quest.status === "complete").length}
      data-claimed-quests={Object.values(props.questProgress).filter((quest) => quest.status === "claimed").length}>
      <div ref={hostRef} className="open-world-phaser__host" aria-label="Savannah Reserve game world" />
      <div className="open-world-phaser__joystick" aria-label="Movement joystick"
        onPointerDown={(event) => { joystickOrigin.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); moveJoystick(event.clientX, event.clientY); }}
        onPointerMove={(event) => moveJoystick(event.clientX, event.clientY)}
        onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick} onLostPointerCapture={releaseJoystick}>
        <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
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
