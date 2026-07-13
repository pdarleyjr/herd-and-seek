import Phaser from "phaser";
import { ALL_ANIMAL_TYPES } from "../../types";
import type { GameBridge } from "../GameBridge";

export type GameSceneVariant = "preview" | "match";

const FILE_BACKED_ANIMALS = new Set([
  "elephant", "penguin", "monkey", "giraffe", "bear", "dog", "frog", "horse", "pig", "rabbit", "cow", "duck", "panda", "parrot", "owl", "snake",
]);

export class PreloadScene extends Phaser.Scene {
  private readonly bridge: GameBridge;
  private readonly variant: GameSceneVariant;

  constructor(bridge: GameBridge, variant: GameSceneVariant) {
    super("PreloadScene");
    this.bridge = bridge;
    this.variant = variant;
  }

  preload(): void {
    for (const animal of ALL_ANIMAL_TYPES) {
      if (FILE_BACKED_ANIMALS.has(animal)) this.load.image(`animal-${animal}`, `/assets/${animal}.png`);
    }
    this.load.svg("hunter-forest", "/game-assets/forest-ranger.svg", { width: 128, height: 128 });
    this.load.svg("hunter-deepDark", "/game-assets/deep-scuba.svg", { width: 128, height: 128 });
    this.load.svg("hunter-savannah", "/game-assets/savannah-ranger.svg", { width: 128, height: 128 });
    this.load.image("tree-round", "/assets/tree.png");
    this.load.image("tree-pine", "/assets/treeBrown.png");
    this.load.image("bush", "/assets/bush.png");

    const width = Math.max(260, Math.min(520, this.scale.width * 0.5));
    const track = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, width, 14, 0x0c2318, 0.85).setOrigin(0.5);
    const bar = this.add.rectangle(track.x - width / 2, track.y, 0, 10, 0xf3c969).setOrigin(0, 0.5);
    const label = this.add.text(track.x, track.y - 34, "Packing the reserve…", { color: "#f8f1d4", fontFamily: "Georgia, serif", fontSize: "18px" }).setOrigin(0.5);
    this.load.on("progress", (value: number) => { bar.width = width * value; });
    this.load.once("complete", () => { track.destroy(); bar.destroy(); label.destroy(); });
    this.load.on("loaderror", (file: { key?: string }) => this.bridge.events.emit("GAMEPLAY_ERROR", { code: "asset_load", detail: `Could not load ${file.key ?? "asset"}` }));
  }

  create(): void {
    this.bridge.events.emit("SCENE_READY", { key: "PreloadScene" });
    const target = this.variant === "preview" ? "LobbyPreviewScene" : "MatchScene";
    this.scene.start(target);
  }
}
