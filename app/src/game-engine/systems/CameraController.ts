import Phaser from "phaser";
import { WORLD_SIZE } from "../../types";

export function configureGameCamera(camera: Phaser.Cameras.Scene2D.Camera, target: Phaser.GameObjects.GameObject): void {
  camera.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
  camera.setDeadzone(Math.min(180, camera.width * 0.2), Math.min(120, camera.height * 0.18));
  camera.startFollow(target, true, 0.12, 0.12);
  camera.setZoom(Phaser.Math.Clamp(Math.min(camera.width / 960, camera.height / 640), 0.72, 1.18));
}
