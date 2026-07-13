import Phaser from "phaser";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_DEPTH,
  GOAL_HALF_HEIGHT,
  type SoccerBridge,
  type SoccerMatchSnapshot,
  type SoccerPlayerSnapshot,
  type SoccerTeamId,
  type SoccerVector,
} from "../soccer";

interface SoccerPlayerVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Arc;
  nameplate: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
}

interface SoccerKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  SHIFT: Phaser.Input.Keyboard.Key;
}

const TEAM_COLORS: Record<SoccerTeamId, { primary: number; dark: number; pale: string }> = {
  coral: { primary: 0xee227d, dark: 0x67134f, pale: "#ffd7d1" },
  teal: { primary: 0x30c0b7, dark: 0x174b62, pale: "#cbfff3" },
};

/**
 * Top-down, transport-neutral soccer presentation. The scene never mutates an
 * external snapshot; all player intent is emitted through SoccerBridge.
 */
export class SoccerScene extends Phaser.Scene {
  private readonly bridge: SoccerBridge;
  private snapshot: SoccerMatchSnapshot;
  private latestRevision = -1;
  private unsubscribe?: () => void;
  private readonly playerVisuals = new Map<string, SoccerPlayerVisual>();
  private ballVisual?: Phaser.GameObjects.Container;
  private ballSprite?: Phaser.GameObjects.Sprite;
  private ballShadow?: Phaser.GameObjects.Ellipse;
  private keys?: SoccerKeys;
  private movementSequence = 0;
  private kickSequence = 0;
  private sendAccumulator = 0;
  private trailAccumulator = 0;
  private facing: SoccerVector = { x: 1, y: 0 };
  private joystickPointerId: number | null = null;
  private aimPointerId: number | null = null;
  private joystickOrigin: SoccerVector = { x: 0, y: 0 };
  private joystickMove: SoccerVector = { x: 0, y: 0 };
  private joystickBase?: Phaser.GameObjects.Arc;
  private joystickKnob?: Phaser.GameObjects.Arc;
  private kickButton?: Phaser.GameObjects.Arc;
  private kickLabel?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private clockText?: Phaser.GameObjects.Text;
  private phaseText?: Phaser.GameObjects.Text;
  private energyFill?: Phaser.GameObjects.Rectangle;
  private goalBanner?: Phaser.GameObjects.Container;
  private previousPhase: SoccerMatchSnapshot["phase"];

  constructor(bridge: SoccerBridge) {
    super("SoccerScene");
    this.bridge = bridge;
    this.snapshot = bridge.getSnapshot();
    this.previousPhase = this.snapshot.phase;
  }

  create(): void {
    this.physics.world.setBounds(-GOAL_DEPTH, 0, FIELD_WIDTH + GOAL_DEPTH * 2, FIELD_HEIGHT);
    this.cameras.main.setBounds(-180, -140, FIELD_WIDTH + 360, FIELD_HEIGHT + 280).setBackgroundColor("#f8c891");
    this.renderArena();
    this.ensureTextures();
    this.createBall();
    this.createHud();
    this.bindInput();
    this.applySnapshot(this.snapshot, true);
    this.unsubscribe = this.bridge.subscribe((snapshot) => this.applySnapshot(snapshot));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutHud, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.emit("soccer-ready", { matchId: this.snapshot.matchId });
  }

  update(_time: number, delta: number): void {
    this.bridge.advance?.(delta);
    const current = this.bridge.getSnapshot();
    if (current.revision > this.latestRevision) this.applySnapshot(current);
    this.updateLocalInput(delta);
    this.updateVisuals(delta);
    this.updateHud();
  }

  private renderArena(): void {
    this.add.rectangle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_WIDTH + 500, FIELD_HEIGHT + 480, 0x7b285f).setDepth(-80);
    this.add.rectangle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_WIDTH + 310, FIELD_HEIGHT + 300, 0xf1a65a).setDepth(-70);
    this.add.rectangle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_WIDTH + 130, FIELD_HEIGHT + 130, 0x3b0855).setDepth(-60);
    const pitch = this.add.graphics().setDepth(-50);
    pitch.fillStyle(0x55a764, 1).fillRoundedRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT, 34);
    const stripeWidth = FIELD_WIDTH / 12;
    for (let index = 0; index < 12; index += 1) {
      pitch.fillStyle(index % 2 === 0 ? 0x4d9d5d : 0x5cad67, 0.72).fillRect(index * stripeWidth, 0, stripeWidth, FIELD_HEIGHT);
    }
    pitch.lineStyle(12, 0xfff3d5, 0.88).strokeRoundedRect(10, 10, FIELD_WIDTH - 20, FIELD_HEIGHT - 20, 25);
    pitch.lineBetween(FIELD_WIDTH / 2, 10, FIELD_WIDTH / 2, FIELD_HEIGHT - 10);
    pitch.strokeCircle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 175);
    pitch.fillStyle(0xfff3d5, 1).fillCircle(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 11);
    pitch.strokeRect(10, FIELD_HEIGHT / 2 - 330, 310, 660);
    pitch.strokeRect(FIELD_WIDTH - 320, FIELD_HEIGHT / 2 - 330, 310, 660);
    pitch.strokeRect(10, FIELD_HEIGHT / 2 - 170, 125, 340);
    pitch.strokeRect(FIELD_WIDTH - 135, FIELD_HEIGHT / 2 - 170, 125, 340);
    pitch.strokeCircle(260, FIELD_HEIGHT / 2, 7);
    pitch.strokeCircle(FIELD_WIDTH - 260, FIELD_HEIGHT / 2, 7);

    this.renderGoal(-GOAL_DEPTH, "teal");
    this.renderGoal(FIELD_WIDTH, "coral");
    this.renderCrowd();
    this.renderCornerFlags();
    this.add.text(FIELD_WIDTH / 2, -83, "MEADOWBANK  •  FIELD LEAGUE", {
      fontFamily: "Arial Rounded MT Bold, Trebuchet MS, sans-serif",
      fontSize: "32px",
      fontStyle: "bold",
      color: "#fff3d5",
      letterSpacing: 5,
      stroke: "#3b0855",
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(-5);
  }

  private renderGoal(x: number, defendedBy: SoccerTeamId): void {
    const goal = this.add.graphics().setDepth(-35);
    const top = FIELD_HEIGHT / 2 - GOAL_HALF_HEIGHT;
    goal.fillStyle(0xf8e9d2, 0.18).fillRect(x, top, GOAL_DEPTH, GOAL_HALF_HEIGHT * 2);
    goal.lineStyle(9, 0xfff3d5, 1).strokeRect(x, top, GOAL_DEPTH, GOAL_HALF_HEIGHT * 2);
    goal.lineStyle(2, TEAM_COLORS[defendedBy].primary, 0.56);
    for (let offset = 14; offset < GOAL_DEPTH; offset += 14) goal.lineBetween(x + offset, top, x + offset, top + GOAL_HALF_HEIGHT * 2);
    for (let offset = 18; offset < GOAL_HALF_HEIGHT * 2; offset += 18) goal.lineBetween(x, top + offset, x + GOAL_DEPTH, top + offset);
  }

  private renderCrowd(): void {
    const crowd = this.add.graphics().setDepth(-55);
    const palette = [0xee227d, 0x30c0b7, 0xffc85b, 0xfff3d5, 0x498099];
    for (let index = 0; index < 88; index += 1) {
      const x = 50 + ((index * 149) % (FIELD_WIDTH - 100));
      const top = index % 2 === 0;
      const y = top ? -84 - (index % 3) * 32 : FIELD_HEIGHT + 84 + (index % 3) * 32;
      const color = palette[index % palette.length];
      crowd.fillStyle(color, 1).fillCircle(x, y, 13 + (index % 2) * 3);
      crowd.fillStyle(0x3b0855, 0.82).fillRoundedRect(x - 15, y + 11, 30, 25, 6);
    }
  }

  private renderCornerFlags(): void {
    const corners = [[5, 5], [FIELD_WIDTH - 5, 5], [5, FIELD_HEIGHT - 5], [FIELD_WIDTH - 5, FIELD_HEIGHT - 5]];
    for (const [x, y] of corners) {
      const flag = this.add.graphics({ x, y }).setDepth(-20);
      flag.lineStyle(7, 0xfff3d5, 1).lineBetween(0, 0, 0, y < FIELD_HEIGHT / 2 ? 60 : -60);
      flag.fillStyle(0xee227d, 1).fillTriangle(0, y < FIELD_HEIGHT / 2 ? 2 : -2, x < FIELD_WIDTH / 2 ? 44 : -44, y < FIELD_HEIGHT / 2 ? 22 : -22, 0, y < FIELD_HEIGHT / 2 ? 36 : -36);
    }
  }

  private ensureTextures(): void {
    this.ensurePlayerTexture("soccer-player-coral", "coral");
    this.ensurePlayerTexture("soccer-player-teal", "teal");
    if (!this.textures.exists("soccer-ball")) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0x3b0855, 0.23).fillCircle(38, 41, 27);
      graphics.fillStyle(0xfff3d5, 1).fillCircle(36, 34, 27);
      graphics.lineStyle(5, 0x4d175c, 1).strokeCircle(36, 34, 27);
      graphics.fillStyle(0x852467, 1).fillPoints([
        new Phaser.Math.Vector2(36, 23), new Phaser.Math.Vector2(46, 30), new Phaser.Math.Vector2(42, 42),
        new Phaser.Math.Vector2(30, 42), new Phaser.Math.Vector2(26, 30),
      ], true);
      graphics.lineStyle(4, 0x852467, 1);
      graphics.lineBetween(36, 23, 32, 8); graphics.lineBetween(46, 30, 61, 26);
      graphics.lineBetween(42, 42, 49, 57); graphics.lineBetween(30, 42, 20, 55); graphics.lineBetween(26, 30, 11, 25);
      graphics.generateTexture("soccer-ball", 76, 72);
      graphics.destroy();
    }
  }

  private ensurePlayerTexture(key: string, team: SoccerTeamId): void {
    if (this.textures.exists(key)) return;
    const color = TEAM_COLORS[team];
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x3b0855, 0.22).fillEllipse(49, 91, 62, 21);
    graphics.lineStyle(13, color.dark, 1).lineBetween(39, 69, 33, 90).lineBetween(59, 69, 65, 90);
    graphics.lineStyle(12, color.dark, 1).lineBetween(31, 45, 16, 64).lineBetween(67, 45, 82, 64);
    graphics.fillStyle(color.primary, 1).fillRoundedRect(25, 31, 48, 48, 12);
    graphics.lineStyle(5, color.dark, 1).strokeRoundedRect(25, 31, 48, 48, 12);
    graphics.fillStyle(0xfff3d5, 0.9).fillRoundedRect(43, 36, 12, 32, 4);
    graphics.fillStyle(team === "coral" ? 0xf1b17f : 0x9b674e, 1).fillCircle(49, 21, 20);
    graphics.lineStyle(5, color.dark, 1).strokeCircle(49, 21, 20);
    graphics.fillStyle(color.dark, 1).fillRoundedRect(29, 5, 40, 12, 5);
    graphics.fillStyle(0xfff3d5, 1).fillCircle(43, 22, 2.5).fillCircle(56, 22, 2.5);
    graphics.generateTexture(key, 98, 104);
    graphics.destroy();
  }

  private createBall(): void {
    const shadow = this.add.ellipse(0, 15, 48, 20, 0x32123d, 0.25);
    const ball = this.add.sprite(0, 0, "soccer-ball").setDisplaySize(58, 55);
    this.ballShadow = shadow;
    this.ballSprite = ball;
    this.ballVisual = this.add.container(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, [shadow, ball]).setDepth(FIELD_HEIGHT / 2 + 6);
  }

  private createHud(): void {
    const scoreboard = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);
    const boardShadow = this.add.rectangle(0, 7, 338, 91, 0x23062f, 0.42).setOrigin(0.5, 0);
    const board = this.add.rectangle(0, 0, 338, 91, 0x3b0855, 0.96).setOrigin(0.5, 0).setStrokeStyle(3, 0xfff3d5, 0.82);
    const coralPill = this.add.rectangle(-112, 45, 88, 54, 0xee227d, 1).setStrokeStyle(3, 0x67134f, 1);
    const tealPill = this.add.rectangle(112, 45, 88, 54, 0x30c0b7, 1).setStrokeStyle(3, 0x174b62, 1);
    const coralLetter = this.add.text(-112, 45, "C", { fontFamily: "Arial Rounded MT Bold", fontSize: "21px", fontStyle: "bold", color: "#fff3d5" }).setOrigin(0.5);
    const tealLetter = this.add.text(112, 45, "T", { fontFamily: "Arial Rounded MT Bold", fontSize: "21px", fontStyle: "bold", color: "#fff3d5" }).setOrigin(0.5);
    this.scoreText = this.add.text(0, 51, "0  —  0", { fontFamily: "Arial Rounded MT Bold", fontSize: "31px", fontStyle: "bold", color: "#fff3d5" }).setOrigin(0.5);
    this.clockText = this.add.text(0, 15, "03:00", { fontFamily: "Trebuchet MS", fontSize: "17px", fontStyle: "bold", color: "#ffd76c", letterSpacing: 3 }).setOrigin(0.5);
    scoreboard.add([boardShadow, board, coralPill, tealPill, coralLetter, tealLetter, this.scoreText, this.clockText]);
    scoreboard.setName("soccer-scoreboard");

    const phaseBack = this.add.rectangle(0, 0, 380, 50, 0xfff3d5, 0.94).setStrokeStyle(3, 0x3b0855, 0.82);
    this.phaseText = this.add.text(0, 0, "KICKOFF", { fontFamily: "Trebuchet MS", fontSize: "16px", fontStyle: "bold", color: "#3b0855", letterSpacing: 2 }).setOrigin(0.5);
    this.add.container(0, 0, [phaseBack, this.phaseText]).setName("soccer-phase").setScrollFactor(0).setDepth(1999);

    const energyPanel = this.add.rectangle(0, 0, 196, 45, 0x3b0855, 0.88).setOrigin(0, 0.5).setStrokeStyle(2, 0xfff3d5, 0.55);
    const energyTrack = this.add.rectangle(18, 0, 160, 12, 0x21072c, 0.9).setOrigin(0, 0.5);
    this.energyFill = this.add.rectangle(18, 0, 160, 12, 0xffc85b, 1).setOrigin(0, 0.5);
    const energyLabel = this.add.text(18, -17, "SPRINT", { fontFamily: "Trebuchet MS", fontSize: "9px", fontStyle: "bold", color: "#fff3d5", letterSpacing: 2 });
    this.add.container(0, 0, [energyPanel, energyTrack, this.energyFill, energyLabel]).setName("soccer-energy").setScrollFactor(0).setDepth(1998);

    this.joystickBase = this.add.circle(0, 0, 61, 0x3b0855, 0.26).setStrokeStyle(4, 0xfff3d5, 0.58).setScrollFactor(0).setDepth(2100).setVisible(false);
    this.joystickKnob = this.add.circle(0, 0, 27, 0xfff3d5, 0.9).setStrokeStyle(4, 0x852467, 0.92).setScrollFactor(0).setDepth(2101).setVisible(false);
    this.kickButton = this.add.circle(0, 0, 51, 0xee227d, 0.94).setStrokeStyle(5, 0xfff3d5, 0.94).setScrollFactor(0).setDepth(2100);
    this.kickLabel = this.add.text(0, 0, "KICK", { fontFamily: "Arial Rounded MT Bold", fontSize: "15px", fontStyle: "bold", color: "#fff3d5", stroke: "#67134f", strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(2101);
    this.goalBanner = this.createGoalBanner();
    this.layoutHud();
  }

  private createGoalBanner(): Phaser.GameObjects.Container {
    const panel = this.add.rectangle(0, 0, 520, 138, 0xfff3d5, 0.98).setStrokeStyle(7, 0x3b0855, 1);
    const top = this.add.rectangle(0, -55, 520, 28, 0xee227d, 1);
    const title = this.add.text(0, -7, "GOAL!", { fontFamily: "Arial Rounded MT Bold", fontSize: "58px", fontStyle: "bold", color: "#3b0855", stroke: "#fd8083", strokeThickness: 2 }).setOrigin(0.5);
    const copy = this.add.text(0, 45, "The crowd goes wild", { fontFamily: "Trebuchet MS", fontSize: "14px", fontStyle: "bold", color: "#852467", letterSpacing: 2 }).setOrigin(0.5);
    title.setName("goal-title"); copy.setName("goal-copy");
    return this.add.container(0, 0, [panel, top, title, copy]).setScrollFactor(0).setDepth(3000).setVisible(false).setScale(0.6);
  }

  private bindInput(): void {
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,SPACE,SHIFT") as SoccerKeys | undefined;
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
  }

  private applySnapshot(snapshot: SoccerMatchSnapshot, force = false): void {
    if (!force && snapshot.revision < this.latestRevision) return;
    const previousPhase = this.previousPhase;
    this.snapshot = snapshot;
    this.latestRevision = snapshot.revision;
    this.previousPhase = snapshot.phase;
    const activeIds = new Set(snapshot.players.map((player) => player.id));
    for (const [id, visual] of this.playerVisuals) {
      if (activeIds.has(id)) continue;
      visual.container.destroy(true);
      this.playerVisuals.delete(id);
    }
    for (const player of snapshot.players) this.upsertPlayer(player, force);
    if (previousPhase !== snapshot.phase) this.onPhaseChanged(snapshot);
  }

  private upsertPlayer(player: SoccerPlayerSnapshot, force: boolean): void {
    let visual = this.playerVisuals.get(player.id);
    const local = player.id === this.bridge.localPlayerId;
    if (!visual) {
      const shadow = this.add.ellipse(0, 39, 72, 25, 0x32123d, 0.25);
      const marker = this.add.circle(0, 10, 52, local ? 0xffd76c : TEAM_COLORS[player.team].primary, local ? 0.06 : 0).setStrokeStyle(local ? 5 : 0, local ? 0xffd76c : 0x000000, local ? 0.95 : 0);
      const body = this.add.sprite(0, 0, `soccer-player-${player.team}`).setDisplaySize(94, 100);
      const displayName = player.username.length > 14 ? `${player.username.slice(0, 13)}…` : player.username;
      const nameplate = this.add.text(0, -65, displayName, {
        fontFamily: "Trebuchet MS",
        fontSize: "13px",
        fontStyle: local ? "bold" : "normal",
        color: local ? "#fff3aa" : TEAM_COLORS[player.team].pale,
        backgroundColor: local ? "#3b0855e8" : "#32123dbd",
        padding: { x: 7, y: 3 },
      }).setOrigin(0.5);
      const role = this.add.text(0, 61, player.role === "keeper" ? "GK" : player.role === "striker" ? "ST" : "MF", {
        fontFamily: "Trebuchet MS", fontSize: "9px", fontStyle: "bold", color: "#3b0855", backgroundColor: "#fff3d5df", padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
      const container = this.add.container(player.x, player.y, [shadow, marker, body, nameplate, role]).setDepth(player.y);
      visual = { container, body, shadow, marker, nameplate, targetX: player.x, targetY: player.y };
      this.playerVisuals.set(player.id, visual);
      if (local) {
        this.cameras.main.startFollow(container, true, 0.1, 0.1);
        const widthZoom = this.scale.width / 1_260;
        const heightZoom = this.scale.height / 820;
        this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(widthZoom, heightZoom), 0.68, 1.08));
      }
    }
    visual.targetX = player.x;
    visual.targetY = player.y;
    if (force) visual.container.setPosition(player.x, player.y);
    if (visual.body.texture.key !== `soccer-player-${player.team}`) visual.body.setTexture(`soccer-player-${player.team}`);
  }

  private updateLocalInput(delta: number): void {
    const local = this.snapshot.players.find((player) => player.id === this.bridge.localPlayerId);
    if (!local || !this.keys) return;
    const keyboard = {
      x: (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0),
      y: (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0),
    };
    const movement = Math.hypot(this.joystickMove.x, this.joystickMove.y) > 0.01 ? this.joystickMove : keyboard;
    if (Math.hypot(movement.x, movement.y) > 0.01) {
      const length = Math.max(1, Math.hypot(movement.x, movement.y));
      this.facing = { x: movement.x / length, y: movement.y / length };
    }
    this.sendAccumulator += Math.min(delta, 100);
    if (this.sendAccumulator >= 50) {
      this.sendAccumulator = 0;
      this.bridge.send({
        type: "MOVE",
        payload: { x: movement.x, y: movement.y, sprint: this.keys.SHIFT.isDown || Math.hypot(this.joystickMove.x, this.joystickMove.y) > 0.82, sequence: ++this.movementSequence },
      });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.kick(this.kickTargetFromFacing(local));
  }

  private updateVisuals(delta: number): void {
    const smoothing = 1 - Math.exp(-Math.min(delta, 100) / 72);
    const now = this.time.now;
    for (const player of this.snapshot.players) {
      const visual = this.playerVisuals.get(player.id);
      if (!visual) continue;
      visual.container.x = Phaser.Math.Linear(visual.container.x, visual.targetX, smoothing);
      visual.container.y = Phaser.Math.Linear(visual.container.y, visual.targetY, smoothing);
      visual.container.setDepth(visual.container.y);
      const speed = Math.hypot(player.vx, player.vy);
      const stride = speed > 15 ? Math.sin(now / 78 + hashPhase(player.id)) : Math.sin(now / 410 + hashPhase(player.id)) * 0.2;
      visual.body.setY(-Math.abs(stride) * (speed > 15 ? 5 : 2)).setAngle(stride * (speed > 15 ? 4.5 : 1.2));
      visual.body.setScale(player.facingX < -0.05 ? -Math.abs(visual.body.scaleX) : Math.abs(visual.body.scaleX), visual.body.scaleY);
      visual.shadow.setScale(1 - Math.abs(stride) * 0.08, 1 - Math.abs(stride) * 0.12);
      visual.marker.setAngle(now * 0.025);
    }

    if (this.ballVisual && this.ballSprite && this.ballShadow) {
      this.ballVisual.x = Phaser.Math.Linear(this.ballVisual.x, this.snapshot.ball.x, Math.min(1, smoothing * 1.8));
      this.ballVisual.y = Phaser.Math.Linear(this.ballVisual.y, this.snapshot.ball.y, Math.min(1, smoothing * 1.8));
      this.ballVisual.setDepth(this.ballVisual.y + 8);
      const speed = Math.hypot(this.snapshot.ball.vx, this.snapshot.ball.vy);
      this.ballSprite.rotation += (speed / 26 + this.snapshot.ball.spin * 8) * delta / 1000;
      this.ballSprite.y = -Math.min(12, speed / 68) - Math.abs(Math.sin(now / 70)) * Math.min(6, speed / 150);
      this.ballShadow.setScale(Phaser.Math.Clamp(1 - Math.abs(this.ballSprite.y) / 48, 0.64, 1));
      this.trailAccumulator += delta;
      if (speed > 560 && this.trailAccumulator >= 85) {
        this.trailAccumulator = 0;
        const puff = this.add.circle(this.ballVisual.x, this.ballVisual.y + 12, 9, 0xfff3d5, 0.48).setDepth(this.ballVisual.y - 3);
        this.tweens.add({ targets: puff, alpha: 0, scale: 2.4, duration: 360, ease: "Sine.easeOut", onComplete: () => puff.destroy() });
      }
    }
  }

  private updateHud(): void {
    const minutes = Math.floor(this.snapshot.remainingMs / 60_000);
    const seconds = Math.floor((this.snapshot.remainingMs % 60_000) / 1000);
    this.clockText?.setText(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    this.scoreText?.setText(`${this.snapshot.coralScore}  —  ${this.snapshot.tealScore}`);
    const local = this.snapshot.players.find((player) => player.id === this.bridge.localPlayerId);
    if (this.energyFill && local) this.energyFill.displayWidth = Math.max(2, 160 * local.energy);
    if (this.snapshot.phase === "kickoff") {
      const count = Math.max(1, Math.ceil(this.snapshot.phaseRemainingMs / 1000));
      this.phaseText?.setText(`KICKOFF  ${count}`);
    } else if (this.snapshot.phase === "ended") {
      const result = this.snapshot.coralScore === this.snapshot.tealScore ? "FULL TIME  •  DRAW" : this.snapshot.coralScore > this.snapshot.tealScore ? "FULL TIME  •  CORAL WIN" : "FULL TIME  •  TEAL WIN";
      this.phaseText?.setText(result);
      this.kickLabel?.setText("REPLAY").setFontSize(12);
    } else if (this.snapshot.phase === "goal") {
      this.phaseText?.setText("GOAL  •  RESETTING PLAY");
    } else {
      this.phaseText?.setText("FIELD LEAGUE  •  LIVE");
      this.kickLabel?.setText("KICK").setFontSize(15);
    }
  }

  private onPhaseChanged(snapshot: SoccerMatchSnapshot): void {
    if (snapshot.phase === "goal") this.celebrateGoal(snapshot);
    if (snapshot.phase === "kickoff") this.goalBanner?.setVisible(false);
    if (snapshot.phase === "ended") this.showFullTime();
  }

  private celebrateGoal(snapshot: SoccerMatchSnapshot): void {
    const scorer = snapshot.players.find((player) => player.id === snapshot.lastScorerId);
    const title = this.goalBanner?.getByName("goal-title") as Phaser.GameObjects.Text | null;
    const copy = this.goalBanner?.getByName("goal-copy") as Phaser.GameObjects.Text | null;
    title?.setText("GOAL!");
    copy?.setText(scorer ? `${scorer.username.toUpperCase()} FINDS THE NET` : "THE CROWD GOES WILD");
    this.goalBanner?.setVisible(true).setAlpha(0).setScale(0.62);
    this.tweens.add({ targets: this.goalBanner, alpha: 1, scale: 1, duration: 420, ease: "Back.easeOut" });
    const colors = [0xee227d, 0x30c0b7, 0xffc85b, 0xfff3d5];
    for (let index = 0; index < 34; index += 1) {
      const confetti = this.add.rectangle(this.scale.width / 2 + Phaser.Math.Between(-210, 210), this.scale.height / 2 - 45, 10, 17, colors[index % colors.length]).setScrollFactor(0).setDepth(2990).setAngle(index * 37);
      this.tweens.add({
        targets: confetti,
        x: confetti.x + Phaser.Math.Between(-260, 260),
        y: this.scale.height + 70,
        angle: confetti.angle + Phaser.Math.Between(180, 680),
        alpha: 0,
        duration: 1_100 + (index % 8) * 75,
        ease: "Quad.easeIn",
        onComplete: () => confetti.destroy(),
      });
    }
  }

  private showFullTime(): void {
    const title = this.goalBanner?.getByName("goal-title") as Phaser.GameObjects.Text | null;
    const copy = this.goalBanner?.getByName("goal-copy") as Phaser.GameObjects.Text | null;
    title?.setText("FULL TIME").setFontSize(44);
    copy?.setText(`${this.snapshot.coralScore}  —  ${this.snapshot.tealScore}  •  PRESS REPLAY`);
    this.goalBanner?.setVisible(true).setAlpha(0).setScale(0.82);
    this.tweens.add({ targets: this.goalBanner, alpha: 1, scale: 1, duration: 360, ease: "Cubic.easeOut" });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const kickX = width - Math.max(78, Math.min(118, width * 0.095));
    const kickY = height - Math.max(84, Math.min(118, height * 0.14));
    if (Math.hypot(pointer.x - kickX, pointer.y - kickY) <= 68) {
      const local = this.snapshot.players.find((player) => player.id === this.bridge.localPlayerId);
      if (this.snapshot.phase === "ended") this.bridge.send({ type: "RESTART" });
      else if (local) this.kick(this.kickTargetFromFacing(local));
      return;
    }
    if (pointer.x <= width * 0.58 && pointer.y >= height * 0.36 && this.joystickPointerId === null) {
      this.joystickPointerId = pointer.id;
      this.joystickOrigin = { x: pointer.x, y: pointer.y };
      this.joystickBase?.setPosition(pointer.x, pointer.y).setVisible(true);
      this.joystickKnob?.setPosition(pointer.x, pointer.y).setVisible(true);
      return;
    }
    if (this.aimPointerId === null) this.aimPointerId = pointer.id;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joystickPointerId) return;
    const dx = pointer.x - this.joystickOrigin.x;
    const dy = pointer.y - this.joystickOrigin.y;
    const distance = Math.hypot(dx, dy);
    const radius = 54;
    const scale = distance > radius ? radius / distance : 1;
    const limitedX = dx * scale;
    const limitedY = dy * scale;
    this.joystickKnob?.setPosition(this.joystickOrigin.x + limitedX, this.joystickOrigin.y + limitedY);
    this.joystickMove = { x: limitedX / radius, y: limitedY / radius };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickMove = { x: 0, y: 0 };
      this.joystickBase?.setVisible(false);
      this.joystickKnob?.setVisible(false);
    }
    if (pointer.id === this.aimPointerId) {
      const local = this.snapshot.players.find((player) => player.id === this.bridge.localPlayerId);
      if (local) this.kick({ x: pointer.worldX, y: pointer.worldY });
      this.aimPointerId = null;
    }
  }

  private kick(target: SoccerVector): void {
    if (this.snapshot.phase !== "playing") return;
    this.bridge.send({ type: "KICK", payload: { target, power: 0.92, sequence: ++this.kickSequence } });
    this.cameras.main.shake(85, 0.0012);
    if (this.kickButton) {
      this.tweens.killTweensOf(this.kickButton);
      this.kickButton.setScale(0.86);
      this.tweens.add({ targets: this.kickButton, scale: 1, duration: 160, ease: "Cubic.easeOut" });
    }
  }

  private kickTargetFromFacing(local: SoccerPlayerSnapshot): SoccerVector {
    const fallback = local.team === "coral" ? 1 : -1;
    const facing = Math.hypot(this.facing.x, this.facing.y) > 0.01 ? this.facing : { x: fallback, y: 0 };
    return { x: local.x + facing.x * 720, y: local.y + facing.y * 720 };
  }

  private layoutHud(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const scoreboard = this.children.getByName("soccer-scoreboard") as Phaser.GameObjects.Container | null;
    const phase = this.children.getByName("soccer-phase") as Phaser.GameObjects.Container | null;
    const energy = this.children.getByName("soccer-energy") as Phaser.GameObjects.Container | null;
    scoreboard?.setPosition(width / 2, 18).setScale(width < 560 ? 0.78 : 1);
    phase?.setPosition(width / 2, width < 560 ? 101 : 121).setScale(width < 560 ? 0.76 : 1);
    energy?.setPosition(20, height - 38).setScale(width < 560 ? 0.8 : 1);
    const kickX = width - Math.max(78, Math.min(118, width * 0.095));
    const kickY = height - Math.max(84, Math.min(118, height * 0.14));
    this.kickButton?.setPosition(kickX, kickY).setScale(width < 560 ? 0.88 : 1);
    this.kickLabel?.setPosition(kickX, kickY);
    this.goalBanner?.setPosition(width / 2, height / 2).setScale(width < 620 ? 0.72 : 1);
    const widthZoom = width / 1_260;
    const heightZoom = height / 820;
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(widthZoom, heightZoom), 0.68, 1.08));
  }

  private cleanup(): void {
    this.unsubscribe?.();
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutHud, this);
    this.playerVisuals.clear();
    this.bridge.destroy?.();
  }
}

function hashPhase(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33 + value.charCodeAt(index)) % 628;
  return hash / 100;
}
