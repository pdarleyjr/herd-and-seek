import { soundManager } from "../../SoundManager";

export class AudioSystem {
  unlock(): void { soundManager.unlock(); }
  shot(): void { soundManager.gunshot(); }
  hit(): void { soundManager.hit(); }
  miss(): void { soundManager.miss(); }
  perk(): void { soundManager.perk(); }
  matchStart(): void { soundManager.gameStart(); }
  matchEnd(): void { soundManager.gameEnd(); }
  settings() { return soundManager.settings(); }
  setMuted(muted: boolean): void { soundManager.setEnabled(!muted); }
  setMaster(volume: number): void { soundManager.setMasterVolume(volume); }
  setEffects(volume: number): void { soundManager.setEffectsVolume(volume); }
  setMusic(volume: number): void { soundManager.setMusicVolume(volume); }
}

export const gameAudio = new AudioSystem();
