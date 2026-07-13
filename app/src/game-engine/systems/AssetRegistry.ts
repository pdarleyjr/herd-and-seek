import Phaser from "phaser";
import { ANIMAL_DEFS, type AnimalType, type LevelId } from "../../types";

export function ensureAnimalTexture(scene: Phaser.Scene, animal: AnimalType): string {
  const key = `animal-${animal}`;
  if (scene.textures.exists(key)) return key;
  const def = ANIMAL_DEFS[animal];
  const color = Phaser.Display.Color.HexStringToColor(def?.color ?? "#c79658").color;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  if (def?.ocean) drawOceanAnimal(graphics, animal, color);
  else if (def?.savannah) drawSavannahAnimal(graphics, animal, color);
  else drawFace(graphics, color);
  graphics.generateTexture(key, 96, 96);
  graphics.destroy();
  return key;
}

export function hunterTextureFor(levelId: LevelId): string {
  return `hunter-${levelId}`;
}

function drawFace(g: Phaser.GameObjects.Graphics, color: number) {
  g.fillStyle(color, 1).fillEllipse(48, 48, 78, 68);
  g.fillStyle(0xf5e9cf, 0.9).fillEllipse(48, 58, 44, 30);
  g.fillStyle(0x1f2b24, 1).fillCircle(34, 39, 5).fillCircle(62, 39, 5).fillCircle(48, 55, 5);
  g.lineStyle(4, 0x26382b, 0.35).strokeEllipse(48, 48, 78, 68);
}

function drawOceanAnimal(g: Phaser.GameObjects.Graphics, animal: AnimalType, color: number) {
  g.lineStyle(4, 0x082c3c, 0.65);
  if (animal === "crab") {
    g.fillStyle(color).fillEllipse(48, 52, 54, 38).fillCircle(20, 38, 13).fillCircle(76, 38, 13);
    for (const y of [48, 58, 68]) g.lineBetween(30, y, 10, y + 10).lineBetween(66, y, 86, y + 10);
    g.fillStyle(0xf4efe0).fillCircle(38, 45, 6).fillCircle(58, 45, 6); g.fillStyle(0x142f38).fillCircle(38, 45, 3).fillCircle(58, 45, 3);
  } else if (animal === "octopus" || animal === "jellyfish") {
    g.fillStyle(color, animal === "jellyfish" ? 0.72 : 1).fillEllipse(48, 37, 55, 48);
    for (let x = 25; x <= 71; x += 12) { g.lineStyle(animal === "jellyfish" ? 5 : 9, color, .9); g.beginPath().moveTo(x, 55).lineTo(x - 5, 75).lineTo(x + 4, 90).strokePath(); }
    g.fillStyle(0xf2f7ef).fillCircle(39, 35, 5).fillCircle(57, 35, 5); g.fillStyle(0x163442).fillCircle(39, 35, 2.5).fillCircle(57, 35, 2.5);
  } else if (animal === "turtle") {
    g.fillStyle(color).fillEllipse(48, 50, 62, 70).fillCircle(48, 12, 12);
    g.fillEllipse(17, 37, 22, 12).fillEllipse(79, 37, 22, 12).fillEllipse(20, 69, 18, 10).fillEllipse(76, 69, 18, 10);
    g.lineStyle(4, 0x214b32, .8).strokeEllipse(48, 50, 52, 60).lineBetween(23, 50, 73, 50).lineBetween(48, 20, 48, 80);
  } else if (animal === "stingray") {
    g.fillStyle(color).fillTriangle(48, 8, 6, 56, 90, 56).fillTriangle(18, 52, 78, 52, 48, 82);
    g.lineStyle(6, color).lineBetween(48, 72, 48, 94); g.fillStyle(0xf2f4e9).fillCircle(38, 42, 5).fillCircle(58, 42, 5);
  } else if (animal === "seahorse") {
    g.fillStyle(color).fillEllipse(48, 35, 34, 48).fillTriangle(52, 18, 78, 27, 54, 34).fillEllipse(43, 66, 22, 42);
    g.lineStyle(8, color).beginPath().moveTo(43, 77).lineTo(57, 88).lineTo(48, 94).strokePath(); g.fillStyle(0xf5f0d8).fillCircle(43, 31, 5);
  } else {
    g.fillStyle(color).fillEllipse(46, 49, animal === "shark" ? 72 : 60, animal === "shark" ? 32 : 42).fillTriangle(15, 49, 0, 28, 0, 70);
    if (animal === "shark") g.fillTriangle(48, 37, 64, 12, 69, 41);
    g.fillStyle(0xf4f2de).fillCircle(60, 43, 5); g.fillStyle(0x102d38).fillCircle(61, 43, 2.5);
    if (animal === "fish") { g.lineStyle(5, 0xffd27b, .8).lineBetween(37, 33, 37, 64).lineBetween(50, 33, 50, 64); }
  }
}

function drawSavannahAnimal(g: Phaser.GameObjects.Graphics, animal: AnimalType, color: number) {
  const dark = 0x3b3024;
  if (animal === "ostrich" || animal === "secretarybird") {
    g.fillStyle(color).fillEllipse(46, 42, 45, 38); g.lineStyle(8, dark).lineBetween(38, 58, 32, 90).lineBetween(55, 58, 62, 90);
    g.lineStyle(10, color).lineBetween(54, 30, 64, 10); g.fillStyle(color).fillCircle(66, 10, 9); g.fillStyle(0xf5e8be).fillCircle(69, 8, 2.5);
  } else if (animal === "meerkat") {
    g.fillStyle(color).fillEllipse(48, 55, 32, 68).fillCircle(48, 20, 19); g.fillTriangle(33, 12, 36, 0, 44, 13).fillTriangle(52, 13, 61, 0, 63, 15);
    g.fillStyle(dark).fillCircle(41, 18, 3).fillCircle(56, 18, 3).fillCircle(48, 28, 3);
  } else {
    g.fillStyle(color).fillEllipse(47, 52, 68, 40).fillEllipse(67, 34, 35, 30);
    g.fillRect(22, 64, 10, 25).fillRect(43, 66, 10, 23).fillRect(63, 60, 10, 29);
    if (animal === "gazelle") { g.lineStyle(5, dark).beginPath().moveTo(62, 23).lineTo(57, 3).lineTo(65, 15).moveTo(73, 22).lineTo(80, 3).lineTo(72, 15).strokePath(); }
    if (animal === "zebra") { g.lineStyle(5, dark); for (let x = 25; x < 65; x += 11) g.lineBetween(x, 35, x + 8, 67); }
    if (animal === "warthog") { g.fillStyle(0xf1e1b6).fillTriangle(70, 39, 93, 43, 72, 48); }
    if (animal === "wildebeest") { g.lineStyle(5, dark).lineBetween(62, 25, 51, 12).lineBetween(74, 25, 86, 12); }
    if (animal === "hyena") { g.fillStyle(dark, .7).fillCircle(30, 45, 4).fillCircle(43, 55, 4).fillCircle(58, 42, 4); }
    g.fillStyle(0xf6ebcb).fillCircle(64, 31, 4); g.fillStyle(dark).fillCircle(65, 31, 2);
  }
}
