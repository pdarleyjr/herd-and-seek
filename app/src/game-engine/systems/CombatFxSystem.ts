import Phaser from "phaser";

export class CombatFxSystem {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  muzzleFlash(x: number, y: number, targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    const flash = this.scene.add.star(x + Math.cos(angle) * 38, y + Math.sin(angle) * 38, 7, 4, 13, 0xffe38a, 1).setDepth(40).setRotation(angle);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 90, onComplete: () => flash.destroy() });
    this.scene.cameras.main.shake(70, 0.0025);
  }

  impact(x: number, y: number, hit: boolean): void {
    const color = hit ? 0xffe96e : 0xd8bf8d;
    for (let index = 0; index < 8; index += 1) {
      const fleck = this.scene.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9).setDepth(35);
      const angle = (Math.PI * 2 * index) / 8;
      this.scene.tweens.add({ targets: fleck, x: x + Math.cos(angle) * Phaser.Math.Between(18, 40), y: y + Math.sin(angle) * Phaser.Math.Between(18, 40), alpha: 0, duration: 260, onComplete: () => fleck.destroy() });
    }
  }

  perkBurst(x: number, y: number, color = 0xf5d66f): void {
    const ring = this.scene.add.circle(x, y, 30, color, 0).setStrokeStyle(5, color, 0.9).setDepth(38);
    this.scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 500, ease: "Quart.easeOut", onComplete: () => ring.destroy() });
  }
}
