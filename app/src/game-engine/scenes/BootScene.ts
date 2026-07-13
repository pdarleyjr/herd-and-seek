import Phaser from "phaser";
import type { GameBridge } from "../GameBridge";
import type { GameSceneVariant } from "./PreloadScene";

export class BootScene extends Phaser.Scene {
  private readonly bridge: GameBridge;
  private readonly variant: GameSceneVariant;

  constructor(bridge: GameBridge, variant: GameSceneVariant) {
    super("BootScene");
    this.bridge = bridge;
    this.variant = variant;
  }

  create(): void {
    this.bridge.events.emit("SCENE_READY", { key: "BootScene" });
    this.scene.start("PreloadScene", { variant: this.variant });
  }
}
