import Phaser from "phaser";
import { DISTRICTS, OPEN_WORLD_WORLD_SIZE, type CollectibleNode, type OpenWorldPlayerState, type OpenWorldZoneState } from "../../open-world/openWorldTypes";
import { resolveContextAction, type ContextAction } from "../../open-world/openWorldControls";
import type { OpenWorldBridge, OpenWorldSnapshot } from "../OpenWorldBridge";
import { ensureAnimalTexture } from "../systems/AssetRegistry";
import { InputManager } from "../systems/InputManager";
import { RemotePlayerInterpolator } from "../systems/RemotePlayerInterpolator";

const LODGE = DISTRICTS.find((district) => district.id === "lodge")!;
const MOVE_SPEED = 320;
const SYNC_INTERVAL_MS = 66;

interface PlayerVisual {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  nameplate: Phaser.GameObjects.Text;
  sequence: number;
  highlight?: Phaser.GameObjects.Arc;
}

export class OpenWorldScene extends Phaser.Scene {
  private readonly bridge: OpenWorldBridge;
  private snapshot: OpenWorldSnapshot = { zoneState: null, profile: null, questProgress: {} };
  private local?: PlayerVisual;
  private readonly remotes = new Map<string, PlayerVisual>();
  private readonly collectibles = new Map<string, Phaser.GameObjects.Container>();
  private readonly interpolator = new RemotePlayerInterpolator(100);
  private inputManager?: InputManager;
  private joystick = { x: 0, y: 0 };
  private target: Phaser.Math.Vector2 | null = null;
  private currentAction: ContextAction | null = null;
  private syncElapsed = 0;
  private minimap?: Phaser.GameObjects.Graphics;
  private unsubscribers: Array<() => void> = [];

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
    this.createReserve();
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
    this.local.sprite.setVelocity(x * MOVE_SPEED, y * MOVE_SPEED);
    if (x !== 0) this.local.sprite.setFlipX(x < 0);
    this.local.sprite.setAngle(moving ? Math.sin(time / 85) * 2 : Math.sin(time / 340));
    this.updateVisualPosition(this.local, this.local.sprite.x, this.local.sprite.y);
    this.bridge.reportPosition(this.local.sprite.x, this.local.sprite.y);

    this.syncElapsed += Math.min(delta, 100);
    if (moving && this.syncElapsed >= SYNC_INTERVAL_MS) {
      this.syncElapsed = 0;
      this.bridge.runtime.onSync(this.local.sprite.x, this.local.sprite.y, this.bridge.runtime.animalType);
    }
    for (const [id, visual] of this.remotes) {
      const sample = this.interpolator.sample(id, Date.now());
      if (sample) this.updateVisualPosition(visual, sample.x, sample.y);
    }
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
    this.createAmbientDecor();
    for (const district of DISTRICTS) {
      this.add.text(district.cx, district.cy - (district.id === "lodge" ? 170 : 145), district.name, {
        fontFamily: "Georgia, serif", fontSize: "28px", color: "#fff2bd", stroke: "#4a321d", strokeThickness: 6,
      }).setOrigin(0.5).setDepth(900);
    }
    this.add.text(LODGE.cx, LODGE.cy - 235, "SAVANNAH RESERVE", { fontFamily: "Georgia, serif", fontSize: "46px", color: "#fff0b8", stroke: "#4a2b1a", strokeThickness: 8 }).setOrigin(0.5).setDepth(900);
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
      this.tweens.add({ targets: sprite, x: sprite.x + 30 + index % 3 * 12, duration: 2600 + index * 180, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private createAmbientDecor(): void {
    const random = new Phaser.Math.RandomDataGenerator(["reserve-phaser-v1"]);
    for (let index = 0; index < 240; index += 1) {
      const x = random.between(50, OPEN_WORLD_WORLD_SIZE - 50);
      const y = random.between(50, OPEN_WORLD_WORLD_SIZE - 50);
      if (Phaser.Math.Distance.Between(x, y, LODGE.cx, LODGE.cy) < 230) continue;
      const grass = this.add.star(x, y, 4, 2, random.between(9, 17), index % 8 ? 0x8e8c3d : 0xc29243, random.realInRange(0.28, 0.65)).setDepth(y - 3);
      this.tweens.add({ targets: grass, angle: random.between(-6, 6), duration: random.between(1500, 3000), yoyo: true, repeat: -1 });
    }
    for (let index = 0; index < 25; index += 1) this.addAcacia(random.between(120, OPEN_WORLD_WORLD_SIZE - 120), random.between(120, OPEN_WORLD_WORLD_SIZE - 120), random.realInRange(0.65, 1.05));
  }

  private addAcacia(x: number, y: number, scale: number): void {
    const shadow = this.add.ellipse(x + 28, y + 22, 125 * scale, 35 * scale, 0x3d2c19, 0.26).setDepth(y - 2);
    const trunk = this.add.rectangle(x, y - 25 * scale, 18 * scale, 105 * scale, 0x61452d).setDepth(y - 1);
    const canopy = this.add.ellipse(x, y - 90 * scale, 150 * scale, 62 * scale, 0x536f37).setStrokeStyle(5, 0x35492b).setDepth(y);
    this.tweens.add({ targets: [canopy, trunk, shadow], angle: { from: -0.6, to: 0.6 }, duration: 2500 + (x % 700), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private applySnapshot(snapshot: OpenWorldSnapshot): void {
    this.snapshot = snapshot;
    const state = snapshot.zoneState;
    if (!state) return;
    const me = state.players.find((player) => player.id === this.bridge.runtime.userId);
    if (me) this.upsertLocal(me);
    this.syncRemotes(state);
    this.syncCollectibles(state);
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
    for (const [id, visual] of this.remotes) if (!active.has(id)) { visual.sprite.destroy(); visual.shadow.destroy(); visual.nameplate.destroy(); visual.highlight?.destroy(); this.remotes.delete(id); this.interpolator.remove(id); }
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
    this.minimap.clear().fillStyle(0x2e2319, 0.82).fillRoundedRect(x - 6, y - 6, size + 12, size + 12, 14).fillStyle(0xc19a54, 0.95).fillRoundedRect(x, y, size, size, 9);
    for (const district of DISTRICTS) this.minimap.fillStyle(district.id === "wateringHole" ? 0x2e8daf : district.id === "lodge" ? 0xf1c15b : 0x56723c, 1).fillCircle(x + district.cx * scale, y + district.cy * scale, district.id === "lodge" ? 5 : 4);
    this.minimap.fillStyle(0xfff284, 1).fillCircle(x + this.local.sprite.x * scale, y + this.local.sprite.y * scale, 4);
    this.minimap.lineStyle(2, 0xffed9c, 0.8).strokeRoundedRect(x, y, size, size, 9);
  }

  private cleanup(): void {
    this.inputManager?.destroy();
    this.input.off("pointerup", this.handleWorldPointer, this);
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.interpolator.clear();
    this.bridge.reportPrompt(null);
  }
}
