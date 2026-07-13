import Phaser from "phaser";
export class CollectibleEntity extends Phaser.GameObjects.Container { collect(): void { this.scene.tweens.add({ targets: this, alpha: 0, scale: 1.5, duration: 220, onComplete: () => this.destroy(true) }); } }
