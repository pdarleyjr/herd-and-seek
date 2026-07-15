import Phaser from "phaser";
import type { GameBridge } from "./GameBridge";
import { BootScene } from "./scenes/BootScene";
import { LobbyPreviewScene } from "./scenes/LobbyPreviewScene";
import { MatchScene } from "./scenes/MatchScene";
import { PreloadScene, type GameSceneVariant } from "./scenes/PreloadScene";

export function createGameConfig(parent: HTMLElement, bridge: GameBridge, variant: GameSceneVariant): Phaser.Types.Core.GameConfig {
  return {
    // The authored world is sprite/shape based; Canvas avoids software-WebGL
    // stalls on school iPads and low-power browsers while preserving visuals.
    type: Phaser.CANVAS,
    parent,
    width: parent.clientWidth || 1280,
    height: parent.clientHeight || 720,
    backgroundColor: "#173d2b",
    transparent: false,
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    render: { powerPreference: "high-performance", antialias: true },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    scene: [
      new BootScene(bridge, variant),
      new PreloadScene(bridge, variant),
      new LobbyPreviewScene(bridge),
      new MatchScene(bridge),
    ],
    fps: { target: 60, min: 30, smoothStep: true },
  };
}
