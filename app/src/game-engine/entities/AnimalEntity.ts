import { PlayerEntity } from "./PlayerEntity";
export class AnimalEntity extends PlayerEntity { setCamouflaged(active: boolean): void { this.setAlpha(active ? 0.35 : 1); } }
