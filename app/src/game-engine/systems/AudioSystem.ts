import { soundManager, type FootstepSurface, type MusicTrack } from "../../SoundManager";

export class AudioSystem {
  unlock(): void { soundManager.unlock(); }
  shot(): void { soundManager.gunshot(); }
  hit(): void { soundManager.hit(); }
  miss(): void { soundManager.miss(); }
  perk(): void { soundManager.perk(); }
  matchStart(): void { soundManager.gameStart(); }
  matchEnd(): void { soundManager.gameEnd(); }
  footstep(surface: FootstepSurface, intensity?: number): void { soundManager.footstep(surface, intensity); }
  startMusic(track: MusicTrack): void { void soundManager.startMusic(track); }
  stopMusic(): void { soundManager.stopMusic(); }
  settings() { return soundManager.settings(); }
  setMuted(muted: boolean): void { soundManager.setEnabled(!muted); }
  setEffectsEnabled(enabled: boolean): void { soundManager.setEffectsEnabled(enabled); }
  setMusicEnabled(enabled: boolean): void { soundManager.setMusicEnabled(enabled); }
  setMaster(volume: number): void { soundManager.setMasterVolume(volume); }
  setEffects(volume: number): void { soundManager.setEffectsVolume(volume); }
  setMusic(volume: number): void { soundManager.setMusicVolume(volume); }
}

export const gameAudio = new AudioSystem();
