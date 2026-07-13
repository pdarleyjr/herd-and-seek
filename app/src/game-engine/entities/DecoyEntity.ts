import { AnimalEntity } from "./AnimalEntity";
export class DecoyEntity extends AnimalEntity { expire(): void { this.scene.tweens.add({ targets: this, alpha: 0, duration: 280, onComplete: () => this.destroy() }); } }
