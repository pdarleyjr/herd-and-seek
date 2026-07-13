import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundManager } from "./SoundManager";

describe("SoundManager preferences", () => {
  beforeEach(() => localStorage.clear());

  it("keeps music and effects independently controllable and persistent", () => {
    const manager = new SoundManager();
    const listener = vi.fn();
    manager.subscribe(listener);

    manager.setMusicEnabled(false);
    expect(manager.settings()).toMatchObject({ muted: false, musicMuted: true, effectsMuted: false });
    manager.setEffectsEnabled(false);
    expect(manager.settings()).toMatchObject({ musicMuted: true, effectsMuted: true });
    manager.setMusicEnabled(true);
    expect(manager.settings()).toMatchObject({ musicMuted: false, effectsMuted: true });
    expect(localStorage.getItem("hs_audio_music_muted")).toBe("false");
    expect(localStorage.getItem("hs_audio_effects_muted")).toBe("true");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("clamps mixer levels before saving them", () => {
    const manager = new SoundManager();
    manager.setMasterVolume(2);
    manager.setMusicVolume(-1);
    manager.setEffectsVolume(0.42);
    expect(manager.settings()).toMatchObject({ master: 1, music: 0, effects: 0.42 });
  });
});
