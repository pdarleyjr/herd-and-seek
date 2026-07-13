import Phaser from "phaser";
import type { NpcSeed } from "../../types";

export class NpcController {
  protected readonly sprites = new Map<number, Phaser.GameObjects.Sprite>();
  protected readonly scene: Phaser.Scene;
  protected readonly createSprite: (seed: NpcSeed) => Phaser.GameObjects.Sprite;
  constructor(scene: Phaser.Scene, createSprite: (seed: NpcSeed) => Phaser.GameObjects.Sprite) { this.scene = scene; this.createSprite = createSprite; }
  sync(seeds: NpcSeed[]): void {
    const active = new Set(seeds.map((seed) => seed.id));
    for (const [id, sprite] of this.sprites) if (!active.has(id)) { sprite.destroy(); this.sprites.delete(id); }
    for (const seed of seeds) if (!this.sprites.has(seed.id)) this.sprites.set(seed.id, this.createSprite(seed));
  }
  destroy(): void { for (const sprite of this.sprites.values()) sprite.destroy(); this.sprites.clear(); }
}
