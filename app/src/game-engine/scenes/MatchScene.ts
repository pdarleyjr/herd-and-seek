import Phaser from "phaser";
import {
  ANIMAL_SPEED,
  HUNTER_SPEED,
  WORLD_SIZE,
  type PerkType,
  type PlayerState,
  type SerializedState,
} from "../../types";
import type { GameBridge } from "../GameBridge";
import { buildBiomeWorld } from "../maps/worldBuilder";
import { ensureAnimalTexture, hunterTextureFor } from "../systems/AssetRegistry";
import { configureGameCamera } from "../systems/CameraController";
import { CombatFxSystem } from "../systems/CombatFxSystem";
import { InputManager } from "../systems/InputManager";
import { PerformanceMonitor } from "../systems/PerformanceMonitor";
import { createPerkRuntime, getPerkSpec, tryActivatePerk, type PerkRuntime } from "../systems/PerkSystem";
import { normalizeInput, reconcilePosition } from "../systems/PlayerController";
import { qualitySettingsFor } from "../systems/QualityManager";
import { RemotePlayerInterpolator } from "../systems/RemotePlayerInterpolator";

interface PlayerVisual {
  sprite: Phaser.Physics.Arcade.Sprite;
  nameplate: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Ellipse;
  sequence: number;
  highlight?: Phaser.GameObjects.Arc;
}

export class MatchScene extends Phaser.Scene {
  private readonly visuals = new Map<string, PlayerVisual>();
  private readonly npcSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly interpolator = new RemotePlayerInterpolator(100);
  private readonly performanceMonitor = new PerformanceMonitor();
  private inputManager?: InputManager;
  private combatFx?: CombatFxSystem;
  private localPlayer?: PlayerVisual;
  private colliders?: Phaser.Physics.Arcade.StaticGroup;
  private reticle?: Phaser.GameObjects.Arc;
  private state: SerializedState | null = null;
  private sendElapsed = 0;
  private sequence = 0;
  private perkRuntime: PerkRuntime = createPerkRuntime("none");
  private unsubscribers: Array<() => void> = [];

  private readonly bridge: GameBridge;

  constructor(bridge: GameBridge) { super("MatchScene"); this.bridge = bridge; }

  create(): void {
    this.state = this.bridge.state;
    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.inputManager = new InputManager(this);
    this.combatFx = new CombatFxSystem(this);
    this.renderWorld(this.state?.levelId ?? "forest");
    this.reticle = this.add.circle(0, 0, 18, 0xffffff, 0.04).setStrokeStyle(3, 0xffe78f, 0.9).setDepth(500).setVisible(false);
    this.input.on("pointermove", this.updateReticle, this);
    this.input.on("pointerup", this.fireFromPointer, this);
    this.applyState(this.state);

    this.unsubscribers = [
      this.bridge.events.on("MATCH_STATE", ({ state }) => this.applyState(state)),
      this.bridge.events.on("QUALITY_CHANGED", ({ tier }) => {
        const settings = qualitySettingsFor(tier);
        this.cameras.main.setRoundPixels(settings.renderScale < 0.8);
      }),
      this.bridge.events.on("PERK_ACTIVATE", () => this.activatePerk()),
      this.bridge.events.on("DECOY_SPAWN", (payload) => this.spawnDecoy(payload)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.bridge.events.emit("SCENE_READY", { key: "MatchScene" });
  }

  update(_time: number, delta: number): void {
    const state = this.state;
    const local = this.localPlayer;
    if (!state || !local || !this.inputManager) return;
    const player = state.players.find((candidate) => candidate.id === this.bridge.runtime.userId);
    if (!player) return;

    const now = Date.now();
    const isCamouflaged = this.perkRuntime.perk === "camouflage" && this.perkRuntime.activeUntil > now;
    const input = isCamouflaged || !player.isAlive || state.phase !== "PLAYING" ? { x: 0, y: 0 } : normalizeInput(this.inputManager.movement());
    let speed = (player.isHunter ? HUNTER_SPEED : ANIMAL_SPEED) * 72;
    if (player.perk === "speedBoost" && !player.isHunter) speed *= getPerkSpec("speedBoost").speedMultiplier;
    if (this.perkRuntime.perk === "sprint" && this.perkRuntime.activeUntil > now) speed *= getPerkSpec("sprint").speedMultiplier;
    local.sprite.setVelocity(input.x * speed, input.y * speed);
    if (input.x !== 0) local.sprite.setFlipX(input.x < 0);
    const moving = input.x !== 0 || input.y !== 0;
    local.sprite.setAngle(moving ? Math.sin(now / 85) * 2.2 : Math.sin(now / 300) * 0.8);
    local.shadow.setPosition(local.sprite.x, local.sprite.y + 34);
    local.nameplate.setPosition(local.sprite.x, local.sprite.y - 58);
    local.highlight?.setPosition(local.sprite.x, local.sprite.y + 2).setDepth(local.sprite.y - 1);

    if (this.inputManager.perkJustPressed()) this.bridge.events.emit("PERK_ACTIVATE", { perk: player.perk });

    this.sendElapsed += Math.min(delta, 100);
    if (this.sendElapsed >= 50 && moving) {
      this.sendElapsed = 0;
      this.bridge.events.emit("LOCAL_MOVE", { x: local.sprite.x, y: local.sprite.y, sequence: ++this.sequence, timestamp: now });
    }

    for (const remote of state.players) {
      if (remote.id === player.id) continue;
      const visual = this.visuals.get(remote.id);
      const sample = this.interpolator.sample(remote.id, now);
      if (!visual || !sample) continue;
      visual.sprite.setPosition(sample.x, sample.y);
      visual.shadow.setPosition(sample.x, sample.y + 34);
      visual.nameplate.setPosition(sample.x, sample.y - 58);
    }

    const fps = this.performanceMonitor.tick(delta);
    if (fps !== null) this.bridge.events.emit("FPS_UPDATE", { fps });
  }

  private renderWorld(levelId: SerializedState["levelId"]): void {
    this.children.removeAll(true);
    this.colliders = buildBiomeWorld(this, levelId);
    const biomeName = levelId === "forest" ? "Fernwhistle Forest" : levelId === "deepDark" ? "The Deep Dark" : "Savannah at Dusk";
    this.add.text(WORLD_SIZE / 2, 115, biomeName, { fontFamily: "Georgia, serif", fontSize: "44px", color: "#fff0bd", stroke: "#193425", strokeThickness: 8 }).setOrigin(0.5).setDepth(10);
    this.add.text(WORLD_SIZE / 2, 172, levelId === "forest" ? "Moonpond • Old Ranger Trail • Whispering Grove" : "Herd territory", { fontFamily: "Georgia, serif", fontSize: "19px", color: "#e4d39a", backgroundColor: "#152e23b8", padding: { x: 16, y: 8 } }).setOrigin(0.5).setDepth(10);
  }

  private applyState(state: SerializedState | null): void {
    if (!state) return;
    const changedLevel = this.state && this.state.levelId !== state.levelId;
    this.state = state;
    if (changedLevel) this.renderWorld(state.levelId);
    const activeIds = new Set(state.players.map((player) => player.id));
    for (const [id, visual] of this.visuals) {
      if (activeIds.has(id)) continue;
      visual.sprite.destroy(); visual.nameplate.destroy(); visual.shadow.destroy(); visual.highlight?.destroy();
      this.visuals.delete(id); this.interpolator.remove(id);
    }
    for (const player of state.players) this.upsertPlayer(player);
    this.syncNpcs(state);
  }

  private upsertPlayer(player: PlayerState): void {
    let visual = this.visuals.get(player.id);
    const isLocal = player.id === this.bridge.runtime.userId;
    const key = player.isHunter ? hunterTextureFor(this.state?.levelId ?? "forest") : ensureAnimalTexture(this, player.animalType);
    if (!visual) {
      const shadow = this.add.ellipse(player.x, player.y + 34, player.isHunter ? 54 : 72, 26, 0x102018, 0.32).setDepth(player.y - 2);
      const highlight = isLocal ? this.add.circle(player.x, player.y + 2, player.isHunter ? 44 : 50, 0xf4d36a, 0.08).setStrokeStyle(3, 0xf4d36a, 0.88).setDepth(player.y - 1) : undefined;
      const sprite = this.physics.add.sprite(player.x, player.y, key).setDepth(player.y).setCollideWorldBounds(true);
      sprite.setDisplaySize(player.isHunter ? 76 : 86, player.isHunter ? 76 : 86);
      sprite.body?.setCircle(player.isHunter ? 24 : 27, Math.max(0, (sprite.width - 54) / 2), Math.max(0, sprite.height - 58));
      const displayName = player.username.length > 16 ? `${player.username.slice(0, 15)}…` : player.username;
      const nameplate = this.add.text(player.x, player.y - 58, displayName, {
        fontFamily: "Verdana, sans-serif", fontSize: "14px", fontStyle: isLocal ? "bold" : "normal", color: isLocal ? "#fff4a8" : "#f7f0dc", backgroundColor: "#10261dcc", padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(450);
      visual = { sprite, nameplate, shadow, sequence: 0, highlight };
      this.visuals.set(player.id, visual);
      if (this.colliders) this.physics.add.collider(sprite, this.colliders);
      if (isLocal) {
        this.localPlayer = visual;
        configureGameCamera(this.cameras.main, sprite);
        this.perkRuntime = createPerkRuntime(player.perk);
      }
    } else if (visual.sprite.texture.key !== key) {
      visual.sprite.setTexture(key).setDisplaySize(player.isHunter ? 76 : 86, player.isHunter ? 76 : 86);
    }
    visual.sprite.setDepth(visual.sprite.y).setAlpha(player.isAlive ? 1 : 0.32);
    visual.nameplate.setAlpha(player.isAlive ? 1 : 0.45);
    if (isLocal) {
      if (this.perkRuntime.perk !== player.perk) this.perkRuntime = createPerkRuntime(player.perk);
      const corrected = reconcilePosition({ x: visual.sprite.x, y: visual.sprite.y }, { x: player.x, y: player.y });
      if (this.state?.phase !== "PLAYING" || Math.hypot(visual.sprite.x - player.x, visual.sprite.y - player.y) > 180) visual.sprite.setPosition(corrected.x, corrected.y);
    } else {
      this.interpolator.push(player.id, { x: player.x, y: player.y, timestamp: Date.now(), sequence: ++visual.sequence });
    }
  }

  private syncNpcs(state: SerializedState): void {
    const ids = new Set(state.npcSeeds.map((npc) => npc.id));
    for (const [id, sprite] of this.npcSprites) if (!ids.has(id)) { sprite.destroy(); this.npcSprites.delete(id); }
    for (const npc of state.npcSeeds) {
      let sprite = this.npcSprites.get(npc.id);
      if (!sprite) {
        sprite = this.add.sprite(npc.x, npc.y, ensureAnimalTexture(this, npc.animalType)).setDisplaySize(72, 72).setAlpha(0.82).setDepth(npc.y);
        this.npcSprites.set(npc.id, sprite);
        this.tweens.add({ targets: sprite, y: npc.y - 7, duration: 900 + (npc.id % 5) * 130, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
  }

  private updateReticle(pointer: Phaser.Input.Pointer): void {
    const me = this.state?.players.find((player) => player.id === this.bridge.runtime.userId);
    if (!me?.isHunter || this.state?.phase !== "PLAYING") { this.reticle?.setVisible(false); return; }
    this.reticle?.setVisible(true).setPosition(pointer.worldX, pointer.worldY);
  }

  private fireFromPointer(pointer: Phaser.Input.Pointer): void {
    const me = this.state?.players.find((player) => player.id === this.bridge.runtime.userId);
    if (!me?.isHunter || this.state?.phase !== "PLAYING" || pointer.x < this.scale.width * 0.45 && pointer.y > this.scale.height * 0.44) return;
    this.bridge.events.emit("SHOOT", { targetX: pointer.worldX, targetY: pointer.worldY });
    if (this.localPlayer) this.combatFx?.muzzleFlash(this.localPlayer.sprite.x, this.localPlayer.sprite.y, pointer.worldX, pointer.worldY);
    this.combatFx?.impact(pointer.worldX, pointer.worldY, false);
  }

  private activatePerk(): void {
    const player = this.state?.players.find((candidate) => candidate.id === this.bridge.runtime.userId);
    if (!player || player.isHunter || !this.localPlayer || !this.inputManager) return;
    const movement = this.inputManager.movement();
    const result = tryActivatePerk(this.perkRuntime, Date.now(), { isMoving: movement.x !== 0 || movement.y !== 0, isAlive: player.isAlive });
    if (!result.activated) {
      if (result.reason === "stationary") this.bridge.events.emit("PLAYER_FEEDBACK", { kind: "blocked", message: "Stand still to camouflage" });
      return;
    }
    this.perkRuntime = result.runtime;
    this.bridge.events.emit("PLAYER_FEEDBACK", { kind: "perk", message: `${player.perk} active` });
    this.combatFx?.perkBurst(this.localPlayer.sprite.x, this.localPlayer.sprite.y, player.perk === "camouflage" ? 0x85c59a : 0xf5d66f);
    if (player.perk === "camouflage") this.localPlayer.sprite.setAlpha(0.35);
    this.time.delayedCall(Math.max(100, getPerkSpec(player.perk as PerkType).durationMs), () => {
      if (this.localPlayer) this.localPlayer.sprite.setAlpha(player.isAlive ? 1 : 0.32);
    });
  }

  private spawnDecoy(payload: { x: number; y: number; animalType: PlayerState["animalType"]; ownerId: string; expiresAt?: number }): void {
    const shadow = this.add.ellipse(0, 31, 68, 23, 0x102018, 0.25);
    const sprite = this.add.sprite(0, 0, ensureAnimalTexture(this, payload.animalType)).setDisplaySize(82, 82).setAlpha(0.72);
    const shimmer = this.add.circle(0, 0, 48, 0x82f3dd, 0.08).setStrokeStyle(3, 0x82f3dd, 0.72);
    const label = this.add.text(0, -56, "DECOY", { fontFamily: "Verdana", fontStyle: "bold", fontSize: "12px", color: "#a8fff0", backgroundColor: "#113d39cc", padding: { x: 6, y: 3 } }).setOrigin(0.5);
    const decoy = this.add.container(payload.x, payload.y, [shadow, shimmer, sprite, label]).setDepth(payload.y + 1);
    this.tweens.add({ targets: [sprite, shimmer], alpha: { from: 0.42, to: 0.85 }, scale: { from: 0.94, to: 1.05 }, duration: 650, yoyo: true, repeat: -1 });
    const ttl = Phaser.Math.Clamp((payload.expiresAt ?? Date.now() + 8_000) - Date.now(), 500, 8_000);
    this.time.delayedCall(ttl, () => this.tweens.add({ targets: decoy, alpha: 0, scale: 0.75, duration: 280, onComplete: () => decoy.destroy(true) }));
  }

  private cleanup(): void {
    this.inputManager?.destroy();
    this.input.off("pointermove", this.updateReticle, this);
    this.input.off("pointerup", this.fireFromPointer, this);
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.interpolator.clear();
    this.visuals.clear();
    this.npcSprites.clear();
  }
}
