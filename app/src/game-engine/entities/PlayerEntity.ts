import Phaser from "phaser";

export class PlayerEntity extends Phaser.Physics.Arcade.Sprite {
  readonly nameplate: Phaser.GameObjects.Text;
  readonly shadow: Phaser.GameObjects.Ellipse;
  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, name: string) {
    super(scene, x, y, texture); scene.add.existing(this); scene.physics.add.existing(this);
    this.shadow = scene.add.ellipse(x, y + 30, 68, 23, 0x102018, 0.28);
    this.nameplate = scene.add.text(x, y - 54, name, { fontFamily: "Verdana", fontSize: "13px", color: "#fff2cf", backgroundColor: "#10261dcc", padding: { x: 6, y: 3 } }).setOrigin(0.5);
  }
  syncPresentation(): void { this.setDepth(this.y); this.shadow.setPosition(this.x, this.y + 30).setDepth(this.y - 2); this.nameplate.setPosition(this.x, this.y - 54).setDepth(900); }
  override destroy(fromScene?: boolean): void { this.shadow.destroy(); this.nameplate.destroy(); super.destroy(fromScene); }
}
