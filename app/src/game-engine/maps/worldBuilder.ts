import Phaser from "phaser";
import type { LevelId } from "../../types";
import { WORLD_SIZE } from "../../types";

const PALETTES: Record<LevelId, { ground: number; tile: number; accent: number; path: number; water: number }> = {
  forest: { ground: 0x315d38, tile: 0x3f7041, accent: 0x98bd4c, path: 0xb98b59, water: 0x4d9aaa },
  deepDark: { ground: 0x092b3e, tile: 0x0d3c50, accent: 0x35a69a, path: 0x315d6c, water: 0x0b5674 },
  savannah: { ground: 0x9e713d, tile: 0xbc8b46, accent: 0xd6b65e, path: 0x77513a, water: 0x4d8990 },
};

const MAP_SCALE = WORLD_SIZE / 2_000;
const sx = (value: number): number => Math.round(value * MAP_SCALE);

export function buildBiomeWorld(scene: Phaser.Scene, levelId: LevelId): Phaser.Physics.Arcade.StaticGroup {
  const palette = PALETTES[levelId];
  const tileKey = `ground-${levelId}`;
  if (!scene.textures.exists(tileKey)) {
    const tile = scene.make.graphics({ x: 0, y: 0 }, false);
    tile.fillStyle(palette.ground).fillRect(0, 0, 64, 64);
    tile.fillStyle(palette.tile, 0.6).fillCircle(12, 18, 3).fillCircle(48, 42, 2).fillRect(28, 8, 3, 9);
    tile.lineStyle(1, palette.accent, 0.16).lineBetween(4, 58, 20, 47).lineBetween(44, 16, 58, 8);
    tile.generateTexture(tileKey, 64, 64);
    tile.destroy();
  }
  scene.add.tileSprite(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, tileKey).setDepth(-30);

  const terrain = scene.add.graphics().setDepth(-22);
  terrain.lineStyle(sx(levelId === "deepDark" ? 125 : 150), palette.path, 0.84);
  terrain.lineBetween(sx(-80), sx(1540), sx(520), sx(1040)).lineBetween(sx(520), sx(1040), sx(1050), sx(900)).lineBetween(sx(1050), sx(900), sx(1540), sx(650)).lineBetween(sx(1540), sx(650), sx(2080), sx(240));
  terrain.fillStyle(palette.water, 0.96).fillEllipse(sx(520), sx(540), sx(460), sx(300));
  terrain.lineStyle(sx(18), levelId === "deepDark" ? 0x3bd1c5 : 0x91c69a, 0.3).strokeEllipse(sx(520), sx(540), sx(480), sx(320));
  if (levelId === "deepDark") addUnderwaterBackdrop(scene);
  if (levelId === "savannah") addSavannahBackdrop(scene);

  const colliders = scene.physics.add.staticGroup();
  const random = new Phaser.Math.RandomDataGenerator([`herd-seek-${levelId}`]);
  const acceptedTrees: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < 96 && acceptedTrees.length < 54; index += 1) {
    const x = random.between(70, WORLD_SIZE - 70);
    const y = random.between(70, WORLD_SIZE - 70);
    if (Phaser.Math.Distance.Between(x, y, sx(520), sx(540)) < sx(280)) continue;
    if (x < sx(420) && y < sx(420)) continue;
    if (acceptedTrees.some((tree) => Phaser.Math.Distance.Between(x, y, tree.x, tree.y) < sx(150))) continue;
    acceptedTrees.push({ x, y });
    if (levelId === "forest" && scene.textures.exists(index % 3 ? "tree-round" : "tree-pine")) {
      const tree = colliders.create(x, y, index % 3 ? "tree-round" : "tree-pine") as Phaser.Physics.Arcade.Image;
      tree.setDisplaySize(index % 3 ? 145 : 120, index % 3 ? 180 : 210).setDepth(y).setAlpha(0.96);
      tree.body?.setSize(54, 46).setOffset((tree.width - 54) / 2, tree.height - 54);
    } else if (levelId === "deepDark") addUnderwaterProp(scene, x, y, index, random);
    else addSavannahProp(scene, x, y, index, random);
  }

  for (let index = 0; index < 210; index += 1) {
    const x = random.between(24, WORLD_SIZE - 24);
    const y = random.between(24, WORLD_SIZE - 24);
    const tuft = scene.add.star(x, y, 4, 3, random.between(8, 15), palette.accent, random.realInRange(0.18, 0.48)).setRotation(random.realInRange(-0.4, 0.4)).setDepth(y - 4);
    if (index % 4 === 0) scene.tweens.add({ targets: tuft, angle: random.between(-5, 5), duration: random.between(1400, 2600), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  return colliders;
}

function addUnderwaterBackdrop(scene: Phaser.Scene): void {
  const light = scene.add.graphics().setDepth(-28).setBlendMode(Phaser.BlendModes.ADD);
  for (let index = 0; index < 9; index += 1) {
    light.fillStyle(index % 2 ? 0x42d9d1 : 0x70b9e9, 0.045);
    light.fillTriangle(index * 260 - 100, -40, index * 260 + 180, -40, index * 240 + 520, WORLD_SIZE + 100);
  }
  scene.tweens.add({ targets: light, x: 90, alpha: { from: 0.45, to: 0.8 }, duration: 5200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 167) % WORLD_SIZE;
    const y = (index * 293) % WORLD_SIZE;
    const bubble = scene.add.circle(x, y, 3 + index % 5, 0xb9f4ef, 0.34).setStrokeStyle(1, 0xe4ffff, 0.45).setDepth(y + 2);
    scene.tweens.add({ targets: bubble, y: y - 180 - index % 4 * 45, x: x + (index % 2 ? 16 : -16), alpha: 0, duration: 3000 + index * 85, repeat: -1, delay: index * 90 });
  }
  const wreck = scene.add.container(sx(1430), sx(1320)).setDepth(sx(1320));
  const hull = scene.add.rectangle(0, 0, 250, 72, 0x594c3d).setRotation(-0.12).setStrokeStyle(7, 0x2d3634);
  const mast = scene.add.rectangle(18, -94, 13, 178, 0x574535).setRotation(0.08);
  const sail = scene.add.triangle(74, -105, 0, 0, 0, 115, 115, 82, 0x62818b, 0.42).setRotation(0.08);
  const title = scene.add.text(0, 64, "THE SUNKEN RANGER", { fontFamily: "Georgia", fontSize: "17px", color: "#9adfd6", backgroundColor: "#082d3cd9", padding: { x: 9, y: 5 } }).setOrigin(0.5);
  wreck.add([hull, mast, sail, title]);
}

function addUnderwaterProp(scene: Phaser.Scene, x: number, y: number, index: number, random: Phaser.Math.RandomDataGenerator): void {
  if (index % 4 === 0) {
    const rock = scene.add.polygon(x, y, [0, 48, 17, 9, 48, 0, 79, 20, 92, 55, 58, 72, 20, 67], index % 8 ? 0x38545b : 0x5b4b55).setStrokeStyle(5, 0x173943).setDepth(y);
    rock.setScale(random.realInRange(0.72, 1.3));
  } else if (index % 4 === 1) {
    const coral = scene.add.container(x, y).setDepth(y);
    const color = index % 3 ? 0xc76d83 : 0xeaa55f;
    for (let branch = -2; branch <= 2; branch += 1) coral.add(scene.add.rectangle(branch * 12, -24 - Math.abs(branch) * 4, 9, 52 - Math.abs(branch) * 5, color).setRotation(branch * 0.18));
    coral.add(scene.add.ellipse(0, 5, 74, 18, 0x163f47, 0.6));
  } else {
    const kelp = scene.add.container(x, y).setDepth(y);
    for (let blade = -2; blade <= 2; blade += 1) {
      const leaf = scene.add.ellipse(blade * 12, -35 - Math.abs(blade) * 5, 13, random.between(70, 130), blade % 2 ? 0x2d8a6d : 0x3da77d, 0.9).setOrigin(0.5, 1).setRotation(blade * 0.1);
      kelp.add(leaf);
      scene.tweens.add({ targets: leaf, angle: { from: -6, to: 6 }, duration: 1700 + blade * 120 + index * 15, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }
}

function addSavannahBackdrop(scene: Phaser.Scene): void {
  const sun = scene.add.circle(sx(1720), sx(180), sx(82), 0xffb84e, 0.3).setDepth(-27).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: sun, scale: 1.18, alpha: 0.16, duration: 2400, yoyo: true, repeat: -1 });
  const grassland = scene.add.ellipse(sx(1320), sx(1320), sx(900), sx(620), 0xd8b452, 0.18).setDepth(-26);
  scene.tweens.add({ targets: grassland, alpha: { from: 0.1, to: 0.24 }, duration: 3600, yoyo: true, repeat: -1 });
  for (const [baseX, baseY] of [[330, 1280], [1120, 1480], [1680, 1050], [1_950, 1_620]] as Array<[number, number]>) {
    const x = sx(baseX);
    const y = sx(baseY);
    const mound = scene.add.ellipse(x, y, 70, 92, 0x7b5434).setStrokeStyle(5, 0x563725).setDepth(y);
    scene.add.circle(x - 8, y - 20, 7, 0x3a281d).setDepth(y + 1);
    mound.setRotation((x % 5 - 2) * 0.03);
  }
}

function addSavannahProp(scene: Phaser.Scene, x: number, y: number, index: number, random: Phaser.Math.RandomDataGenerator): void {
  if (index % 5 === 0) {
    scene.add.polygon(x, y, [0, 28, 12, 5, 34, 0, 54, 12, 66, 38, 42, 50, 15, 47], 0x725544).setStrokeStyle(4, 0x50392c).setDepth(y);
    return;
  }
  const shadow = scene.add.ellipse(x + 32, y + 22, 155, 38, 0x4a321d, 0.28).setDepth(y - 2);
  const trunk = scene.add.rectangle(x, y - 30, 18, random.between(95, 135), 0x67442a).setDepth(y - 1);
  const canopy = scene.add.ellipse(x, y - 96, random.between(135, 185), random.between(55, 78), index % 3 ? 0x556b32 : 0x66793a).setStrokeStyle(5, 0x3f4d27).setDepth(y);
  scene.tweens.add({ targets: [canopy, trunk, shadow], angle: { from: -0.45, to: 0.45 }, duration: random.between(2100, 3500), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}
