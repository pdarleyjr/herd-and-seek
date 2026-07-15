import Phaser from "phaser";
import type { Vector2Like } from "../types";

export class InputManager {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<"up" | "down" | "left" | "right" | "perk", Phaser.Input.Keyboard.Key>;
  private touchPointerId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchVector = { x: 0, y: 0 };
  private readonly pressedCodes = new Set<string>();
  private gamepadPerkDown = false;
  private gamepadFireDown = false;
  private readonly resetBound = () => this.reset();
  private readonly nativeKeyDown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE"].includes(event.code)) {
      this.pressedCodes.add(event.code);
      event.preventDefault();
    }
  };
  private readonly nativeKeyUp = (event: KeyboardEvent) => { this.pressedCodes.delete(event.code); };

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable");
    this.cursors = keyboard.createCursorKeys();
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      perk: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };
    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
    scene.input.on("pointerupoutside", this.onPointerUp, this);
    scene.input.on("pointercancel", this.onPointerUp, this);
    window.addEventListener("blur", this.resetBound);
    window.addEventListener("keydown", this.nativeKeyDown);
    window.addEventListener("keyup", this.nativeKeyUp);
    document.addEventListener("visibilitychange", this.resetBound);
  }

  movement(): Vector2Like {
    const keyboardX = (this.cursors.right.isDown || this.keys.right.isDown || this.pressedCodes.has("KeyD") || this.pressedCodes.has("ArrowRight") ? 1 : 0)
      - (this.cursors.left.isDown || this.keys.left.isDown || this.pressedCodes.has("KeyA") || this.pressedCodes.has("ArrowLeft") ? 1 : 0);
    const keyboardY = (this.cursors.down.isDown || this.keys.down.isDown || this.pressedCodes.has("KeyS") || this.pressedCodes.has("ArrowDown") ? 1 : 0)
      - (this.cursors.up.isDown || this.keys.up.isDown || this.pressedCodes.has("KeyW") || this.pressedCodes.has("ArrowUp") ? 1 : 0);
    if (keyboardX || keyboardY) return { x: keyboardX, y: keyboardY };
    const gamepad = this.gamepad();
    const gamepadX = deadzone(gamepad?.axes[0] ?? 0);
    const gamepadY = deadzone(gamepad?.axes[1] ?? 0);
    return gamepadX || gamepadY ? { x: gamepadX, y: gamepadY } : { ...this.touchVector };
  }

  perkJustPressed(): boolean {
    const down = Boolean(this.gamepad()?.buttons[0]?.pressed);
    const edge = down && !this.gamepadPerkDown;
    this.gamepadPerkDown = down;
    return Phaser.Input.Keyboard.JustDown(this.keys.perk) || edge;
  }

  fireJustPressed(): boolean {
    const down = Boolean(this.gamepad()?.buttons[7]?.pressed);
    const edge = down && !this.gamepadFireDown;
    this.gamepadFireDown = down;
    return edge;
  }

  aimVector(): Vector2Like {
    const gamepad = this.gamepad();
    return { x: deadzone(gamepad?.axes[2] ?? 0), y: deadzone(gamepad?.axes[3] ?? 0) };
  }

  reset(): void {
    this.touchPointerId = null;
    this.touchVector = { x: 0, y: 0 };
    this.pressedCodes.clear();
    this.gamepadPerkDown = false;
    this.gamepadFireDown = false;
    for (const key of Object.values(this.keys)) key.reset();
    for (const key of Object.values(this.cursors)) key?.reset?.();
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.scene.input.off("pointerupoutside", this.onPointerUp, this);
    this.scene.input.off("pointercancel", this.onPointerUp, this);
    window.removeEventListener("blur", this.resetBound);
    window.removeEventListener("keydown", this.nativeKeyDown);
    window.removeEventListener("keyup", this.nativeKeyUp);
    document.removeEventListener("visibilitychange", this.resetBound);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.x > this.scene.scale.width * 0.48 || pointer.y < this.scene.scale.height * 0.44) return;
    this.touchPointerId = pointer.id;
    this.touchOrigin = { x: pointer.x, y: pointer.y };
    this.touchVector = { x: 0, y: 0 };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.touchPointerId) return;
    const dx = pointer.x - this.touchOrigin.x;
    const dy = pointer.y - this.touchOrigin.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) this.touchVector = { x: 0, y: 0 };
    else this.touchVector = { x: dx / Math.max(distance, 1), y: dy / Math.max(distance, 1) };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.touchPointerId) return;
    this.touchPointerId = null;
    this.touchVector = { x: 0, y: 0 };
  }

  private gamepad(): Gamepad | null {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
    return [...navigator.getGamepads()].find((candidate): candidate is Gamepad => Boolean(candidate?.connected)) ?? null;
  }
}

function deadzone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude < 0.16) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - 0.16) / 0.84);
}
