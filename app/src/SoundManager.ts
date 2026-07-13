class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = readEnabled();
  private unlocked = false;
  private masterGain: GainNode | null = null;
  private masterVolume = readVolume("hs_audio_master", 0.75);
  private effectsVolume = readVolume("hs_audio_effects", 0.8);
  private musicVolume = readVolume("hs_audio_music", 0.55);

  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyGain();
      this.unlocked = true;
    } catch {
      this.enabled = false;
    }
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled || !this.unlocked) return null;
    if (!this.ctx) return null;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private output(ctx: AudioContext): AudioNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.connect(ctx.destination);
      this.applyGain();
    }
    return this.masterGain;
  }

  private applyGain() {
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.masterVolume * this.effectsVolume : 0;
  }

  gunshot() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const duration = 0.15;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output(ctx));
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  hit() {
    const ctx = this.getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(250, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  miss() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  perk() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  gameStart() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.connect(gain);
      gain.connect(this.output(ctx));
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  gameEnd() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(this.output(ctx));
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem("hs_audio_muted", enabled ? "false" : "true");
    this.applyGain();
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clampVolume(volume);
    localStorage.setItem("hs_audio_master", String(this.masterVolume));
    this.applyGain();
  }

  setEffectsVolume(volume: number) {
    this.effectsVolume = clampVolume(volume);
    localStorage.setItem("hs_audio_effects", String(this.effectsVolume));
    this.applyGain();
  }

  setMusicVolume(volume: number) {
    this.musicVolume = clampVolume(volume);
    localStorage.setItem("hs_audio_music", String(this.musicVolume));
  }

  settings() { return { muted: !this.enabled, master: this.masterVolume, effects: this.effectsVolume, music: this.musicVolume }; }

  isEnabled() {
    return this.enabled;
  }

  isUnlocked() {
    return this.unlocked;
  }
}

export const soundManager = new SoundManager();

function clampVolume(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.75)); }
function readVolume(key: string, fallback: number): number {
  if (typeof localStorage === "undefined") return fallback;
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}
function readEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem("hs_audio_muted") !== "true";
}
