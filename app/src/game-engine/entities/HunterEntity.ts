import { PlayerEntity } from "./PlayerEntity";
export class HunterEntity extends PlayerEntity { recoil(): void { this.scene.tweens.add({ targets: this, scale: 0.9, duration: 45, yoyo: true }); } }
