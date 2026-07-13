import Phaser from "phaser";
import type { AnimalType, LevelId, PerkType } from "../../types";
import type { GameBridge } from "../GameBridge";
import { ensureAnimalTexture } from "../systems/AssetRegistry";

export class LobbyPreviewScene extends Phaser.Scene {
  private animal: AnimalType = "rabbit";
  private level: LevelId = "forest";
  private perk: PerkType = "none";
  private avatar?: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Ellipse;
  private backdrop?: Phaser.GameObjects.Graphics;
  private unsubscribers: Array<() => void> = [];

  private readonly bridge: GameBridge;

  constructor(bridge: GameBridge) { super("LobbyPreviewScene"); this.bridge = bridge; }

  create(): void {
    this.cameras.main.setBackgroundColor("#244d34");
    this.drawBackdrop();
    this.createAvatar();
    this.unsubscribers = [
      this.bridge.events.on("SELECTED_ANIMAL", ({ animalType }) => { this.animal = animalType; this.createAvatar(); }),
      this.bridge.events.on("SELECTED_LEVEL", ({ levelId }) => { this.level = levelId; this.drawBackdrop(); }),
      this.bridge.events.on("SELECTED_PERK", ({ perk }) => { this.perk = perk; this.demonstratePerk(); }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe()));
    this.bridge.events.emit("SCENE_READY", { key: "LobbyPreviewScene" });
  }

  private drawBackdrop(): void {
    this.backdrop?.destroy();
    const colors = this.level === "forest" ? [0x163d29, 0x6fa34b] : this.level === "deepDark" ? [0x061d35, 0x167a88] : [0x6f3f35, 0xd49a43];
    const g = this.add.graphics().setDepth(-5);
    g.fillGradientStyle(colors[0], colors[0], colors[1], colors[1], 1).fillRect(0, 0, this.scale.width, this.scale.height);
    g.fillStyle(0xf8d77b, 0.22).fillCircle(this.scale.width * 0.78, this.scale.height * 0.22, Math.min(this.scale.width, this.scale.height) * 0.18);
    g.fillStyle(0x112a20, 0.28).fillEllipse(this.scale.width / 2, this.scale.height * 0.86, this.scale.width * 0.82, this.scale.height * 0.24);
    this.backdrop = g;
  }

  private createAvatar(): void {
    this.avatar?.destroy();
    this.shadow?.destroy();
    const key = ensureAnimalTexture(this, this.animal);
    this.avatar = this.add.sprite(this.scale.width / 2, this.scale.height * 0.54, key).setDisplaySize(150, 150).setDepth(3);
    this.avatar.setOrigin(0.5, 0.72);
    this.shadow = this.add.ellipse(this.avatar.x, this.avatar.y + 52, 132, 34, 0x102117, 0.32).setDepth(1);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.tweens.add({ targets: this.avatar, y: this.avatar.y - 9, angle: 1.5, duration: 900, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    }
  }

  private demonstratePerk(): void {
    if (!this.avatar || this.perk === "none") return;
    const color = this.perk === "camouflage" ? 0x85c59a : this.perk === "extraLife" ? 0xf08c8c : 0xf2cf69;
    const ring = this.add.circle(this.avatar.x, this.avatar.y, 54, color, 0).setStrokeStyle(5, color, 0.85).setDepth(2);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 700, ease: "Quart.easeOut", onComplete: () => ring.destroy() });
  }
}
