import Phaser from "phaser";
import { DISTRICTS, OPEN_WORLD_WORLD_SIZE, type CollectibleNode, type OpenWorldPlayerState, type OpenWorldZoneState } from "../../open-world/openWorldTypes";
import { resolveContextAction, type ContextAction } from "../../open-world/openWorldControls";
import type { OpenWorldBridge, OpenWorldSnapshot } from "../OpenWorldBridge";
import { ensureAnimalTexture } from "../systems/AssetRegistry";
import { EnvironmentalAudioCueSystem } from "../systems/EnvironmentalAudioCueSystem";
import { InputManager } from "../systems/InputManager";
import { LocomotionAnimationSystem, prefersReducedMotion, type LocomotionRole } from "../systems/LocomotionAnimationSystem";
import { recommendQuality } from "../systems/QualityManager";
import { RemotePlayerInterpolator } from "../systems/RemotePlayerInterpolator";
import { createOpenWorldTerrainSurfaceSystem, type TerrainSample } from "../systems/TerrainSurfaceSystem";
import { WaterRippleSystem } from "../systems/WaterRippleSystem";
import type { QualityTier } from "../types";

const LODGE = DISTRICTS.find((district) => district.id === "lodge")!;
const WATERING_HOLE = DISTRICTS.find((district) => district.id === "wateringHole")!;
const RIDGE = DISTRICTS.find((district) => district.id === "ridgeTrail")!;
const MOONFERN = DISTRICTS.find((district) => district.id === "moonfernForest")!;
const MOVE_SPEED = 320;
const SYNC_INTERVAL_MS = 66;

interface PlayerVisual {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  nameplate: Phaser.GameObjects.Text;
  sequence: number;
  highlight?: Phaser.GameObjects.Arc;
}

function hashOpenWorldActor(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967295;
}

interface AmbientBehavior {
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  nextDecisionAt: number;
  speed: number;
  resting: boolean;
}

export class OpenWorldScene extends Phaser.Scene {
  private readonly bridge: OpenWorldBridge;
  private snapshot: OpenWorldSnapshot = { zoneState: null, profile: null, questProgress: {} };
  private local?: PlayerVisual;
  private readonly remotes = new Map<string, PlayerVisual>();
  private readonly collectibles = new Map<string, Phaser.GameObjects.Container>();
  private readonly ambientNpcs = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly ambientNpcMotion = new Map<string, { x: number; y: number; time: number }>();
  private readonly ambientNpcBehavior = new Map<string, AmbientBehavior>();
  private readonly interpolator = new RemotePlayerInterpolator(100);
  private readonly locomotion = new LocomotionAnimationSystem();
  private readonly terrain = createOpenWorldTerrainSurfaceSystem({
    lodge: { x: LODGE.cx, y: LODGE.cy },
    wateringHole: { x: WATERING_HOLE.cx, y: WATERING_HOLE.cy },
    ridge: { x: RIDGE.cx, y: RIDGE.cy },
    secondaryWater: [{ x: MOONFERN.cx - 30, y: MOONFERN.cy + 45, radiusX: 130, radiusY: 75 }],
    trailDestinations: DISTRICTS.filter((district) => district.id !== "lodge").map((district) => ({ x: district.cx, y: district.cy })),
  });
  private inputManager?: InputManager;
  private ripples?: WaterRippleSystem;
  private environmentalCues?: EnvironmentalAudioCueSystem;
  private joystick = { x: 0, y: 0 };
  private target: Phaser.Math.Vector2 | null = null;
  private currentAction: ContextAction | null = null;
  private syncElapsed = 0;
  private minimap?: Phaser.GameObjects.Graphics;
  private worldEventMarker?: Phaser.GameObjects.Container;
  private worldEventId = "";
  private unsubscribers: Array<() => void> = [];
  private quality: QualityTier = "balanced";
  private reducedMotion = false;

  constructor(bridge: OpenWorldBridge) { super("OpenWorldScene"); this.bridge = bridge; }

  preload(): void {
    this.load.image("tree-round", "/assets/tree.png");
    this.load.image("tree-pine", "/assets/treeBrown.png");
    this.load.image("bush", "/assets/bush.png");
  }

  create(): void {
    this.physics.world.setBounds(0, 0, OPEN_WORLD_WORLD_SIZE, OPEN_WORLD_WORLD_SIZE);
    this.cameras.main.setBounds(0, 0, OPEN_WORLD_WORLD_SIZE, OPEN_WORLD_WORLD_SIZE).setBackgroundColor("#cba45c");
    this.inputManager = new InputManager(this);
    this.reducedMotion = prefersReducedMotion();
    this.quality = recommendQuality(window.devicePixelRatio || 1, navigator.hardwareConcurrency || 4);
    this.createReserve();
    this.ripples = new WaterRippleSystem(this, {
      quality: this.quality,
      reducedMotion: this.reducedMotion,
      onDisplacement: (cue) => this.events.emit("environment-displacement", cue),
    });
    this.environmentalCues = new EnvironmentalAudioCueSystem({
      quality: this.quality,
      emit: (cue) => this.events.emit("environment-audio-cue", cue),
    });
    this.snapshot = this.bridge.snapshot;
    this.applySnapshot(this.snapshot);
    this.input.on("pointerup", this.handleWorldPointer, this);
    this.unsubscribers = [
      this.bridge.onSnapshot((snapshot) => this.applySnapshot(snapshot)),
      this.bridge.onJoystick((vector) => { this.joystick = vector; if (Math.hypot(vector.x, vector.y) > 0.08) this.target = null; }),
      this.bridge.onTarget(({ x, y }) => { this.target = new Phaser.Math.Vector2(x, y); }),
      this.bridge.onAction(() => this.performAction()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.bridge.reportReady("OpenWorldScene");
  }

  update(time: number, delta: number): void {
    if (!this.local || !this.inputManager) return;
    const keyboard = this.inputManager.movement();
    let x = Phaser.Math.Clamp(keyboard.x + this.joystick.x, -1, 1);
    let y = Phaser.Math.Clamp(keyboard.y + this.joystick.y, -1, 1);
    if (Math.hypot(x, y) < 0.02 && this.target) {
      const distance = Phaser.Math.Distance.Between(this.local.sprite.x, this.local.sprite.y, this.target.x, this.target.y);
      if (distance < 18) this.target = null;
      else { x = (this.target.x - this.local.sprite.x) / distance; y = (this.target.y - this.local.sprite.y) / distance; }
    }
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    const moving = Math.hypot(x, y) > 0.02;
    const localSurface = this.terrain.sample(this.local.sprite.x, this.local.sprite.y);
    const localSpeed = MOVE_SPEED * localSurface.speedMultiplier;
    const velocityX = x * localSpeed;
    const velocityY = y * localSpeed;
    this.local.sprite.setVelocity(velocityX, velocityY);
    if (x !== 0) this.local.sprite.setFlipX(x < 0);
    this.updateVisualPosition(this.local, this.local.sprite.x, this.local.sprite.y);
    const localPose = this.locomotion.update(this.bridge.runtime.userId, this.local, {
      elapsedMs: time,
      velocityX,
      velocityY,
      maxSpeed: MOVE_SPEED,
      surface: localSurface,
      role: "animal",
      reducedMotion: this.reducedMotion,
    });
    this.local.nameplate.y -= localPose.bobPx * 0.22;
    this.updateEnvironment(this.bridge.runtime.userId, "animal", this.local.sprite.x, this.local.sprite.y, Math.hypot(velocityX, velocityY), localSurface, time);
    this.bridge.reportPosition(this.local.sprite.x, this.local.sprite.y);

    this.syncElapsed += Math.min(delta, 100);
    if (moving && this.syncElapsed >= SYNC_INTERVAL_MS) {
      this.syncElapsed = 0;
      this.bridge.runtime.onSync(this.local.sprite.x, this.local.sprite.y, this.bridge.runtime.animalType);
    }
    for (const [id, visual] of this.remotes) {
      const sample = this.interpolator.sample(id, Date.now());
      if (!sample) continue;
      const velocityX = (sample.x - visual.sprite.x) * 1_000 / Math.max(delta, 1);
      const velocityY = (sample.y - visual.sprite.y) * 1_000 / Math.max(delta, 1);
      this.updateVisualPosition(visual, sample.x, sample.y);
      const surface = this.terrain.sample(sample.x, sample.y);
      const pose = this.locomotion.update(id, visual, {
        elapsedMs: time,
        velocityX,
        velocityY,
        maxSpeed: MOVE_SPEED,
        surface,
        role: "animal",
        reducedMotion: this.reducedMotion,
      });
      visual.nameplate.y -= pose.bobPx * 0.22;
      this.updateEnvironment(id, "animal", sample.x, sample.y, Math.hypot(velocityX, velocityY), surface, time);
    }
    this.updateAmbientNpcs(time, delta);
    this.refreshActionPrompt();
    this.drawMinimap();
  }

  private createReserve(): void {
    const tileKey = "reserve-ground";
    const ground = this.make.graphics({ x: 0, y: 0 }, false);
    ground.fillGradientStyle(0xcda65d, 0xcda65d, 0x9f793d, 0x9f793d).fillRect(0, 0, 96, 96);
    ground.fillStyle(0xe0bd71, 0.35).fillCircle(15, 18, 3).fillCircle(65, 58, 2).fillCircle(82, 30, 2);
    ground.lineStyle(2, 0x85652f, 0.25).lineBetween(20, 76, 24, 61).lineBetween(48, 30, 53, 16);
    ground.generateTexture(tileKey, 96, 96); ground.destroy();
    this.add.tileSprite(OPEN_WORLD_WORLD_SIZE / 2, OPEN_WORLD_WORLD_SIZE / 2, OPEN_WORLD_WORLD_SIZE, OPEN_WORLD_WORLD_SIZE, tileKey).setDepth(-50);

    const trails = this.add.graphics().setDepth(-35);
    trails.lineStyle(112, 0x7c5835, 0.78);
    for (const district of DISTRICTS.filter((item) => item.id !== "lodge")) trails.lineBetween(LODGE.cx, LODGE.cy, district.cx, district.cy);
    trails.lineStyle(6, 0xe3c37e, 0.35);
    for (const district of DISTRICTS.filter((item) => item.id !== "lodge")) trails.lineBetween(LODGE.cx, LODGE.cy, district.cx, district.cy);

    this.createWateringHole();
    this.createLodge();
    this.createRidge();
    this.createGrove();
    this.createGrasslands();
    this.createMoonfernForest();
    this.createStrikerField();
    this.createAmbientDecor();
    for (const district of DISTRICTS) {
      this.add.text(district.cx, district.cy - (district.id === "lodge" ? 170 : 145), district.name, {
        fontFamily: "Inter, Verdana, sans-serif", fontStyle: "bold", fontSize: "28px", color: "#fff7dd", stroke: "#3B0855", strokeThickness: 7,
      }).setOrigin(0.5).setDepth(900);
    }
    this.add.text(LODGE.cx, LODGE.cy - 235, "THE GRAND RESERVE", { fontFamily: "Inter, Verdana, sans-serif", fontStyle: "bold", fontSize: "46px", color: "#fff7dd", stroke: "#3B0855", strokeThickness: 9 }).setOrigin(0.5).setDepth(900);
    this.minimap = this.add.graphics().setScrollFactor(0).setDepth(2000);
  }

  private createLodge(): void {
    const { cx, cy } = LODGE;
    this.add.ellipse(cx, cy + 20, 360, 250, 0x6d8f49, 0.45).setDepth(-20);
    const building = this.add.container(cx, cy - 12).setDepth(cy);
    const shadow = this.add.ellipse(0, 74, 230, 50, 0x382516, 0.26);
    const body = this.add.rectangle(0, 12, 210, 125, 0x86542d).setStrokeStyle(6, 0x52301b);
    const roof = this.add.triangle(0, -82, -135, 35, 0, -66, 135, 35, 0x49301f).setStrokeStyle(7, 0x2f2118);
    const porch = this.add.rectangle(0, 86, 250, 24, 0xb17a43).setStrokeStyle(5, 0x62401f);
    const door = this.add.rectangle(0, 30, 42, 87, 0x2f2117).setStrokeStyle(4, 0xd3a967);
    const leftWindow = this.add.rectangle(-66, 18, 42, 38, 0x83c8d5).setStrokeStyle(5, 0x4a321d);
    const rightWindow = this.add.rectangle(66, 18, 42, 38, 0x83c8d5).setStrokeStyle(5, 0x4a321d);
    const board = this.add.rectangle(146, 38, 68, 92, 0x81572f).setStrokeStyle(5, 0x49301c);
    const notice = this.add.text(146, 31, "QUEST\nBOARD", { align: "center", fontFamily: "Verdana", fontStyle: "bold", fontSize: "13px", color: "#fff0bd" }).setOrigin(0.5);
    building.add([shadow, body, roof, porch, door, leftWindow, rightWindow, board, notice]);
    for (const x of [-104, 104]) {
      const lantern = this.add.circle(cx + x, cy - 78, 9, 0xffcf55).setDepth(cy + 1);
      this.tweens.add({ targets: lantern, alpha: 0.55, scale: 1.25, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  private createWateringHole(): void {
    const district = DISTRICTS.find((item) => item.id === "wateringHole")!;
    this.add.ellipse(district.cx, district.cy, 440, 310, 0x2c82a0, 0.96).setStrokeStyle(20, 0xd2b36c, 0.9).setDepth(-28);
    for (let index = 0; index < 4; index += 1) {
      const ripple = this.add.ellipse(district.cx - 100 + index * 65, district.cy - 40 + (index % 2) * 75, 30, 14).setStrokeStyle(3, 0xc4f4ec, 0.55).setDepth(-24);
      this.tweens.add({ targets: ripple, scale: 2.1, alpha: 0, duration: 1700 + index * 220, repeat: -1, delay: index * 250 });
    }
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      const x = district.cx + Math.cos(angle) * 240;
      const y = district.cy + Math.sin(angle) * 170;
      this.add.rectangle(x, y, 6, 38, 0x436f3e).setRotation(angle + 0.4).setDepth(y);
    }
  }

  private createGrove(): void {
    const district = DISTRICTS.find((item) => item.id === "acaciaGrove")!;
    for (let index = 0; index < 16; index += 1) {
      const angle = index * 2.399;
      this.addAcacia(district.cx + Math.cos(angle) * (65 + index * 12), district.cy + Math.sin(angle) * (45 + index * 9), 0.85 + (index % 3) * 0.14);
    }
  }

  private createRidge(): void {
    const district = DISTRICTS.find((item) => item.id === "ridgeTrail")!;
    this.add.ellipse(district.cx, district.cy, 520, 250, 0x85603d, 0.9).setStrokeStyle(26, 0x65472f).setDepth(-25);
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      this.add.polygon(district.cx + Math.cos(angle) * 265, district.cy + Math.sin(angle) * 128, [0, 16, 12, 0, 26, 17, 19, 29, 4, 28], 0x665044).setDepth(district.cy + Math.sin(angle) * 128);
    }
    this.add.text(district.cx, district.cy + 20, "RIDGE OVERLOOK  ▲", { fontFamily: "Verdana", fontSize: "17px", color: "#f6d997", backgroundColor: "#513723cc", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(800);
  }

  private createGrasslands(): void {
    const district = DISTRICTS.find((item) => item.id === "grasslands")!;
    this.add.ellipse(district.cx, district.cy, 700, 540, 0xb9a34f, 0.26).setDepth(-29);
    const species = ["zebra", "gazelle", "wildebeest", "meerkat"] as const;
    for (let index = 0; index < 14; index += 1) {
      const sprite = this.add.sprite(district.cx - 260 + (index % 5) * 125, district.cy - 160 + Math.floor(index / 5) * 145, ensureAnimalTexture(this, species[index % species.length])).setDisplaySize(64, 64).setAlpha(0.7).setDepth(district.cy + index * 2);
      const actorId = `reserve-npc:${index}`;
      this.ambientNpcs.set(actorId, sprite);
      this.ambientNpcMotion.set(actorId, { x: sprite.x, y: sprite.y, time: 0 });
      this.ambientNpcBehavior.set(actorId, { homeX: sprite.x, homeY: sprite.y, targetX: sprite.x, targetY: sprite.y, nextDecisionAt: 800 + index * 170, speed: 18 + index % 4 * 5, resting: index % 5 === 0 });
    }
  }

  private createMoonfernForest(): void {
    const district = DISTRICTS.find((item) => item.id === "moonfernForest")!;
    this.add.ellipse(district.cx, district.cy, 760, 650, 0x3b0855, 0.25).setStrokeStyle(24, 0x30c0b7, 0.22).setDepth(-30);
    this.add.ellipse(district.cx - 30, district.cy + 45, 260, 150, 0x498099, 0.92).setStrokeStyle(14, 0x30c0b7, 0.8).setDepth(-27);
    for (let index = 0; index < 38; index += 1) {
      const angle = index * 2.399;
      const radius = 185 + (index % 7) * 34;
      const x = district.cx + Math.cos(angle) * radius;
      const y = district.cy + Math.sin(angle) * radius * 0.78;
      const trunk = this.add.rectangle(x, y - 32, 16, 80, 0x852467).setStrokeStyle(4, 0x3b0855).setDepth(y - 2);
      const crown = this.add.triangle(x, y - 105, -55, 55, 0, -62, 55, 55, index % 3 ? 0x30c0b7 : 0x498099).setStrokeStyle(5, 0x3b0855).setDepth(y - 1);
      if (!this.reducedMotion && index % 3 === 0) this.tweens.add({ targets: [trunk, crown], angle: { from: -0.7, to: 0.7 }, duration: 2300 + index * 35, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    for (let index = 0; index < 12; index += 1) {
      const glow = this.add.circle(district.cx - 250 + index * 43, district.cy + (index % 2 ? 235 : -225), 6, 0xfd8083, 0.75).setDepth(district.cy + 2);
      if (!this.reducedMotion) this.tweens.add({ targets: glow, alpha: 0.2, scale: 1.7, duration: 900 + index * 70, yoyo: true, repeat: -1 });
    }
  }

  private createStrikerField(): void {
    const district = DISTRICTS.find((item) => item.id === "strikerField")!;
    const width = 760;
    const height = 470;
    this.add.rectangle(district.cx, district.cy, width + 70, height + 70, 0x3b0855, 0.78).setStrokeStyle(10, 0x852467).setDepth(-30);
    this.add.rectangle(district.cx, district.cy, width, height, 0x30c0b7, 0.82).setStrokeStyle(8, 0xfff7dd).setDepth(-29);
    const markings = this.add.graphics().setDepth(-28).lineStyle(8, 0xfff7dd, 0.86);
    markings.lineBetween(district.cx, district.cy - height / 2, district.cx, district.cy + height / 2);
    markings.strokeCircle(district.cx, district.cy, 72);
    markings.strokeRect(district.cx - width / 2, district.cy - 110, 105, 220);
    markings.strokeRect(district.cx + width / 2 - 105, district.cy - 110, 105, 220);
    for (const direction of [-1, 1]) {
      const goalX = district.cx + direction * (width / 2 + 30);
      this.add.rectangle(goalX, district.cy, 55, 170, 0xffffff, 0.18).setStrokeStyle(8, 0xffffff, 0.88).setDepth(-26);
    }
    const ball = this.add.circle(district.cx, district.cy, 18, 0xfff7dd).setStrokeStyle(6, 0x3b0855).setDepth(district.cy + 1);
    if (!this.reducedMotion) this.tweens.add({ targets: ball, scale: 1.12, duration: 750, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private createAmbientDecor(): void {
    const random = new Phaser.Math.RandomDataGenerator(["reserve-phaser-v1"]);
    const grassCount = this.quality === "high" ? 620 : this.quality === "balanced" ? 460 : 300;
    for (let index = 0; index < grassCount; index += 1) {
      const x = random.between(50, OPEN_WORLD_WORLD_SIZE - 50);
      const y = random.between(50, OPEN_WORLD_WORLD_SIZE - 50);
      if (Phaser.Math.Distance.Between(x, y, LODGE.cx, LODGE.cy) < 230) continue;
      const grass = this.add.star(x, y, 4, 2, random.between(9, 17), index % 8 ? 0x8e8c3d : 0xc29243, random.realInRange(0.28, 0.65)).setDepth(y - 3);
      if (!this.reducedMotion && index % 3 === 0) this.tweens.add({ targets: grass, angle: random.between(-6, 6), duration: random.between(1500, 3000), yoyo: true, repeat: -1 });
    }
    const treeCount = this.quality === "high" ? 58 : this.quality === "balanced" ? 44 : 30;
    for (let index = 0; index < treeCount; index += 1) this.addAcacia(random.between(120, OPEN_WORLD_WORLD_SIZE - 120), random.between(120, OPEN_WORLD_WORLD_SIZE - 120), random.realInRange(0.65, 1.05));
  }

  private addAcacia(x: number, y: number, scale: number): void {
    const shadow = this.add.ellipse(x + 28, y + 22, 125 * scale, 35 * scale, 0x3d2c19, 0.26).setDepth(y - 2);
    const trunk = this.add.rectangle(x, y - 25 * scale, 18 * scale, 105 * scale, 0x61452d).setDepth(y - 1);
    const canopy = this.add.ellipse(x, y - 90 * scale, 150 * scale, 62 * scale, 0x536f37).setStrokeStyle(5, 0x35492b).setDepth(y);
    if (!this.reducedMotion) this.tweens.add({ targets: [canopy, trunk, shadow], angle: { from: -0.6, to: 0.6 }, duration: 2500 + (x % 700), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private applySnapshot(snapshot: OpenWorldSnapshot): void {
    this.snapshot = snapshot;
    const state = snapshot.zoneState;
    if (!state) return;
    const me = state.players.find((player) => player.id === this.bridge.runtime.userId);
    if (me) this.upsertLocal(me);
    this.syncRemotes(state);
    this.syncCollectibles(state);
    this.syncWorldEvent(state);
  }

  private upsertLocal(player: OpenWorldPlayerState): void {
    if (!this.local) {
      this.local = this.createPlayerVisual(player, true);
      this.cameras.main.startFollow(this.local.sprite, true, 0.12, 0.12).setDeadzone(100, 70).setZoom(this.scale.width < 600 ? 0.82 : this.scale.width < 1000 ? 0.94 : 1.05);
    } else if (Phaser.Math.Distance.Between(this.local.sprite.x, this.local.sprite.y, player.x, player.y) > 260) {
      this.local.sprite.setPosition(player.x, player.y);
    }
  }

  private syncRemotes(state: OpenWorldZoneState): void {
    const active = new Set(state.players.filter((player) => player.id !== this.bridge.runtime.userId).map((player) => player.id));
    for (const [id, visual] of this.remotes) if (!active.has(id)) {
      this.locomotion.forget(id); this.ripples?.remove(id); this.environmentalCues?.remove(id);
      visual.sprite.destroy(); visual.shadow.destroy(); visual.nameplate.destroy(); visual.highlight?.destroy(); this.remotes.delete(id); this.interpolator.remove(id);
    }
    for (const player of state.players) {
      if (player.id === this.bridge.runtime.userId) continue;
      let visual = this.remotes.get(player.id);
      if (!visual) { visual = this.createPlayerVisual(player, false); this.remotes.set(player.id, visual); }
      this.interpolator.push(player.id, { x: player.x, y: player.y, sequence: ++visual.sequence, timestamp: state.serverTime || Date.now() });
    }
  }

  private createPlayerVisual(player: OpenWorldPlayerState, local: boolean): PlayerVisual {
    const shadow = this.add.ellipse(player.x, player.y + 32, 72, 24, 0x352615, 0.32).setDepth(player.y - 2);
    const highlight = local ? this.add.circle(player.x, player.y, 50, 0xffdf67, 0.08).setStrokeStyle(4, 0xffdf67, 0.9).setDepth(player.y - 1) : undefined;
    const sprite = this.physics.add.sprite(player.x, player.y, ensureAnimalTexture(this, player.animalType as never)).setDisplaySize(82, 82).setCollideWorldBounds(true).setDepth(player.y);
    sprite.body?.setCircle(28);
    const nameplate = this.add.text(player.x, player.y - 58, local ? `${player.username} • You` : player.username, { fontFamily: "Verdana", fontSize: "14px", fontStyle: local ? "bold" : "normal", color: local ? "#fff0a1" : "#f8f0dc", backgroundColor: "#3d2b1ccc", padding: { x: 7, y: 3 } }).setOrigin(0.5).setDepth(1000);
    return { sprite, shadow, nameplate, sequence: 0, highlight };
  }

  private updateVisualPosition(visual: PlayerVisual, x: number, y: number): void {
    visual.sprite.setPosition(x, y).setDepth(y);
    visual.shadow.setPosition(x, y + 32).setDepth(y - 2);
    visual.nameplate.setPosition(x, y - 58);
    visual.highlight?.setPosition(x, y).setDepth(y - 1);
  }

  private updateAmbientNpcs(now: number, delta: number): void {
    for (const [actorId, sprite] of this.ambientNpcs) {
      const behavior = this.ambientNpcBehavior.get(actorId);
      if (behavior) {
        const index = Number(actorId.split(":").at(-1) ?? 0);
        if (now >= behavior.nextDecisionAt) {
          const cycle = Math.floor(now / (2_300 + index * 29));
          const phase = hashOpenWorldActor(`${actorId}:${cycle}`);
          const angle = phase * Math.PI * 2;
          const radius = 70 + ((cycle * 37 + index * 19) % 170);
          behavior.resting = (cycle + index) % 6 === 0;
          behavior.targetX = behavior.homeX + Math.cos(angle) * radius;
          behavior.targetY = behavior.homeY + Math.sin(angle) * radius * .66;
          behavior.nextDecisionAt = now + 1_800 + ((index * 251 + cycle * 97) % 2_800);
        }
        if (!behavior.resting && !this.reducedMotion) {
          const dx = behavior.targetX - sprite.x;
          const dy = behavior.targetY - sprite.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 4) {
            const step = Math.min(distance, behavior.speed * Math.min(delta, 100) / 1_000);
            sprite.x += dx / distance * step;
            sprite.y += dy / distance * step;
          }
        }
      }
      const previous = this.ambientNpcMotion.get(actorId) ?? { x: sprite.x, y: sprite.y, time: now - delta };
      const elapsed = previous.time > 0 ? Math.max(now - previous.time, 1) : Math.max(delta, 1);
      const velocityX = (sprite.x - previous.x) * 1_000 / elapsed;
      const velocityY = (sprite.y - previous.y) * 1_000 / elapsed;
      const surface = this.terrain.sample(sprite.x, sprite.y);
      this.locomotion.update(actorId, { sprite }, {
        elapsedMs: now,
        velocityX,
        velocityY,
        maxSpeed: 110,
        surface,
        role: "npc",
        reducedMotion: this.reducedMotion,
      });
      if (Math.abs(velocityX) > 0.5) sprite.setFlipX(velocityX < 0);
      sprite.setDepth(sprite.y);
      this.updateEnvironment(actorId, "npc", sprite.x, sprite.y, Math.hypot(velocityX, velocityY), surface, now);
      this.ambientNpcMotion.set(actorId, { x: sprite.x, y: sprite.y, time: now });
    }
  }

  private syncWorldEvent(state: OpenWorldZoneState): void {
    const event = state.activeWorldEvent;
    if (event?.id === this.worldEventId) return;
    this.worldEventMarker?.destroy(true);
    this.worldEventMarker = undefined;
    this.worldEventId = event?.id ?? "";
    if (!event) return;
    const district = DISTRICTS.find((candidate) => candidate.id === event.districtId);
    if (!district) return;
    const glow = this.add.circle(0, 0, 105, 0xffd45c, .13).setStrokeStyle(8, 0xee227d, .72);
    const beacon = this.add.star(0, 0, 8, 20, 42, 0xffd45c, .95).setStrokeStyle(5, 0x3b0855, 1);
    const label = this.add.text(0, -105, event.title, { fontFamily: "Arial Black, Nunito", fontSize: "18px", color: "#3b0855", backgroundColor: "#fff5deee", padding: { x: 12, y: 7 }, stroke: "#ffd45c", strokeThickness: 2 }).setOrigin(.5);
    this.worldEventMarker = this.add.container(district.cx, district.cy, [glow, beacon, label]).setDepth(district.cy + 8);
    if (!this.reducedMotion) this.tweens.add({ targets: [glow, beacon], scale: { from: .88, to: 1.12 }, angle: 12, duration: 1_100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private updateEnvironment(actorId: string, role: LocomotionRole, x: number, y: number, speed: number, surface: TerrainSample, now: number): void {
    this.ripples?.update({ actorId, x, y, speed, surface, nowMs: now });
    this.environmentalCues?.update({ actorId, role, x, y, speed, surface, nowMs: now });
  }

  private syncCollectibles(state: OpenWorldZoneState): void {
    const ids = new Set(state.collectibles.map((node) => node.id));
    for (const [id, container] of this.collectibles) if (!ids.has(id)) { container.destroy(); this.collectibles.delete(id); }
    for (const node of state.collectibles) if (!this.collectibles.has(node.id)) this.collectibles.set(node.id, this.createCollectible(node));
  }

  private createCollectible(node: CollectibleNode): Phaser.GameObjects.Container {
    const color = node.kind === "coin" ? 0xffd349 : node.kind === "track" ? 0x8b5b37 : node.kind === "supply" ? 0xe5cc8d : 0x7df5dd;
    const glow = this.add.circle(0, 0, 26, color, 0.18);
    const gem = this.add.star(0, 0, 5, 9, 18, color, 1).setStrokeStyle(3, 0xfff3bd, 0.85);
    const label = this.add.text(0, 31, node.kind.toUpperCase(), { fontFamily: "Verdana", fontStyle: "bold", fontSize: "10px", color: "#fff3c2", backgroundColor: "#4b351fd9", padding: { x: 5, y: 2 } }).setOrigin(0.5);
    const container = this.add.container(node.x, node.y, [glow, gem, label]).setDepth(node.y + 1);
    this.tweens.add({ targets: gem, angle: 360, duration: 2600, repeat: -1 });
    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
    return container;
  }

  private refreshActionPrompt(): void {
    if (!this.local || !this.snapshot.zoneState) return;
    const next = resolveContextAction({ zone: this.snapshot.zoneState, localX: this.local.sprite.x, localY: this.local.sprite.y, questProgress: this.snapshot.questProgress, lodge: { x: LODGE.cx, y: LODGE.cy } });
    const before = this.currentAction ? `${this.currentAction.kind}:${this.currentAction.nodeId ?? ""}:${this.currentAction.questId ?? ""}` : "";
    const after = next ? `${next.kind}:${next.nodeId ?? ""}:${next.questId ?? ""}` : "";
    if (before !== after) { this.currentAction = next; this.bridge.reportPrompt(next); }
  }

  private performAction(): void {
    const action = this.currentAction;
    if (!action) return;
    if (action.kind === "collect" && action.nodeId) this.bridge.runtime.onCollectNode(action.nodeId);
    else if (action.kind === "accept" && action.questId) this.bridge.runtime.onAcceptQuest(action.questId);
    else if (action.kind === "claim" && action.questId) this.bridge.runtime.onClaimQuest(action.questId);
    else if (action.kind === "return") this.target = new Phaser.Math.Vector2(LODGE.cx, LODGE.cy);
  }

  private handleWorldPointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.y < 100 || pointer.x < 150 && pointer.y > this.scale.height - 170) return;
    this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
  }

  private drawMinimap(): void {
    if (!this.minimap || !this.local) return;
    const size = this.scale.width < 640 ? 126 : 176;
    const x = this.scale.width - size - 16;
    const y = this.scale.height - size - 104;
    const scale = size / OPEN_WORLD_WORLD_SIZE;
    this.minimap.clear().fillStyle(0x3b0855, 0.88).fillRoundedRect(x - 6, y - 6, size + 12, size + 12, 14).fillStyle(0xfff1cf, 0.94).fillRoundedRect(x, y, size, size, 9);
    for (const district of DISTRICTS) {
      const color = district.id === "wateringHole" ? 0x498099 : district.id === "moonfernForest" ? 0x852467 : district.id === "strikerField" ? 0x30c0b7 : district.id === "lodge" ? 0xee227d : 0x7d9c50;
      this.minimap.fillStyle(color, 1).fillCircle(x + district.cx * scale, y + district.cy * scale, district.id === "lodge" ? 5 : 4);
    }
    this.minimap.fillStyle(0xfd8083, 1).fillCircle(x + this.local.sprite.x * scale, y + this.local.sprite.y * scale, 4);
    this.minimap.lineStyle(3, 0x3b0855, 0.85).strokeRoundedRect(x, y, size, size, 9);
  }

  private cleanup(): void {
    this.inputManager?.destroy();
    this.input.off("pointerup", this.handleWorldPointer, this);
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.ripples?.destroy();
    this.environmentalCues?.clear();
    this.locomotion.destroy();
    this.interpolator.clear();
    this.ambientNpcs.clear();
    this.ambientNpcMotion.clear();
    this.ambientNpcBehavior.clear();
    this.bridge.reportPrompt(null);
  }
}
