import Phaser from "phaser";
export class NpcAnimalEntity extends Phaser.GameObjects.Sprite { setAmbientMotion(): void { this.scene.tweens.add({ targets: this, y: this.y - 6, duration: 900, yoyo: true, repeat: -1 }); } }
