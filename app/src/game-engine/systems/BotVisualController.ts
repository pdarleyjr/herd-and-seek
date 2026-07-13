import Phaser from "phaser";
import type { NpcSeed } from "../../types";
import { NpcController } from "./NpcController";

export class BotVisualController extends NpcController {
  constructor(scene: Phaser.Scene, createSprite: (seed: NpcSeed) => Phaser.GameObjects.Sprite) { super(scene, createSprite); }
  pulseAll(): void { for (const sprite of this.sprites.values()) this.scene.tweens.add({ targets: sprite, scale: { from: 0.96, to: 1.04 }, duration: 850, yoyo: true, repeat: -1 }); }
}
