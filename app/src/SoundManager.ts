export type MusicTrack = "reserve" | "soccer";
export type FootstepSurface = "grass" | "forest" | "sand" | "rock" | "water";

export interface AudioSettings {
  muted: boolean;
  musicMuted: boolean;
  effectsMuted: boolean;
  master: number;
  effects: number;
  music: number;
}

const ASSET_URLS = {
  reserve: "/audio/reserve-theme.wav",
  soccer: "/audio/soccer-theme.wav",
  shot: "/audio/shot.wav",
  confirm: "/audio/ui-confirm.wav",
  "step-grass": "/audio/step-grass.wav",
  "step-forest": "/audio/step-forest.wav",
  "step-sand": "/audio/step-sand.wav",
  "step-rock": "/audio/step-rock.wav",
  "step-water": "/audio/step-water.wav",
} as const;

type AssetKey = keyof typeof ASSET_URLS;
type AudioListener = (settings: AudioSettings) => void;

export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = readBoolean("hs_audio_muted", true, true);
  private effectsEnabled = readBoolean("hs_audio_effects_muted", true, true);
  private musicEnabled = readBoolean("hs_audio_music_muted", true, true);
  private unlocked = false;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private masterVolume = readVolume("hs_audio_master", 0.75);
  private effectsVolume = readVolume("hs_audio_effects", 0.8);
  private musicVolume = readVolume("hs_audio_music", 0.5);
  private buffers = new Map<AssetKey, AudioBuffer>();
  private loading = new Map<AssetKey, Promise<AudioBuffer | null>>();
  private currentTrack: MusicTrack | null = null;
  private requestedTrack: MusicTrack | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicSourceGain: GainNode | null = null;
  private listeners = new Set<AudioListener>();
  private lastFootstepAt = 0;

  unlock(): void {
    if (this.unlocked) {
      void this.resume();
      return;
    }
    try {
      const AudioContextClass = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.createMixer(this.ctx);
      this.unlocked = true;
      void this.resume();
      void Promise.all((Object.keys(ASSET_URLS) as AssetKey[]).map((key) => this.loadAsset(key)));
      if (this.requestedTrack) void this.startMusic(this.requestedTrack);
    } catch {
      this.enabled = false;
      this.emit();
    }
  }

  private async resume(): Promise<void> {
    if (this.ctx?.state === "suspended") {
      try { await this.ctx.resume(); } catch { /* Audio is optional. */ }
    }
  }

  private createMixer(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.effectsGain = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.effectsGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
    this.applyGain();
  }

  private effectsOutput(): AudioNode | null {
    if (!this.enabled || !this.effectsEnabled || !this.unlocked || !this.ctx) return null;
    void this.resume();
    return this.effectsGain;
  }

  private applyGain(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.masterGain?.gain.setTargetAtTime(this.enabled ? this.masterVolume : 0, now, 0.025);
    this.effectsGain?.gain.setTargetAtTime(this.effectsEnabled ? this.effectsVolume : 0, now, 0.025);
    this.musicGain?.gain.setTargetAtTime(this.musicEnabled ? this.musicVolume : 0, now, 0.04);
  }

  private async loadAsset(key: AssetKey): Promise<AudioBuffer | null> {
    const existing = this.buffers.get(key);
    if (existing) return existing;
    const pending = this.loading.get(key);
    if (pending) return pending;
    if (!this.ctx || typeof fetch === "undefined") return null;
    const promise = fetch(ASSET_URLS[key])
      .then((response) => {
        if (!response.ok) throw new Error(`Audio asset ${key} returned ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => this.ctx?.decodeAudioData(bytes) ?? null)
      .then((buffer) => {
        if (buffer) this.buffers.set(key, buffer);
        this.loading.delete(key);
        return buffer;
      })
      .catch(() => {
        this.loading.delete(key);
        return null;
      });
    this.loading.set(key, promise);
    return promise;
  }

  private playBuffer(key: AssetKey, volume = 1, playbackRate = 1): boolean {
    const ctx = this.ctx;
    const output = this.effectsOutput();
    const buffer = this.buffers.get(key);
    if (!ctx || !output || !buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(output);
    source.start();
    return true;
  }

  async startMusic(track: MusicTrack): Promise<void> {
    this.requestedTrack = track;
    if (!this.unlocked || !this.ctx) return;
    if (this.currentTrack === track && this.musicSource) return;
    const buffer = await this.loadAsset(track);
    if (!buffer || !this.ctx || this.requestedTrack !== track) return;

    const now = this.ctx.currentTime;
    if (this.musicSource && this.musicSourceGain) {
      const oldSource = this.musicSource;
      this.musicSourceGain.gain.cancelScheduledValues(now);
      this.musicSourceGain.gain.setValueAtTime(this.musicSourceGain.gain.value, now);
      this.musicSourceGain.gain.linearRampToValueAtTime(0, now + 0.45);
      try { oldSource.stop(now + 0.5); } catch { /* Already stopped. */ }
    }

    const source = this.ctx.createBufferSource();
    const sourceGain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    sourceGain.gain.setValueAtTime(0, now);
    sourceGain.gain.linearRampToValueAtTime(1, now + 0.55);
    source.connect(sourceGain);
    sourceGain.connect(this.musicGain!);
    source.start();
    this.musicSource = source;
    this.musicSourceGain = sourceGain;
    this.currentTrack = track;
    this.applyGain();
  }

  stopMusic(): void {
    this.requestedTrack = null;
    this.currentTrack = null;
    const source = this.musicSource;
    if (source && this.ctx && this.musicSourceGain) {
      const now = this.ctx.currentTime;
      this.musicSourceGain.gain.setTargetAtTime(0, now, 0.12);
      try { source.stop(now + 0.5); } catch { /* Already stopped. */ }
    }
    this.musicSource = null;
    this.musicSourceGain = null;
  }

  gunshot(): void {
    if (this.playBuffer("shot", 0.82, 0.96 + Math.random() * 0.08)) return;
    const ctx = this.ctx;
    const output = this.effectsOutput();
    if (!ctx || !output) return;
    const duration = 0.16;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / data.length, 2.5);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3_000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.58, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(output);
    source.start();
  }

  footstep(surface: FootstepSurface, intensity = 1): void {
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    if (now - this.lastFootstepAt < 95) return;
    this.lastFootstepAt = now;
    const key = `step-${surface}` as AssetKey;
    const rate = 0.92 + Math.random() * 0.16;
    if (!this.playBuffer(key, Math.max(0.2, Math.min(1, intensity)) * 0.55, rate)) void this.loadAsset(key);
  }

  uiConfirm(): void {
    if (!this.playBuffer("confirm", 0.55)) void this.loadAsset("confirm");
  }

  hit(): void { this.playTone(250, 60, 0.3, 0.4, "sine"); }
  miss(): void { this.playTone(800, 400, 0.12, 0.12, "triangle"); }
  perk(): void { this.playTone(400, 1_200, 0.2, 0.15, "sine"); }

  gameStart(): void {
    [523, 659, 784].forEach((frequency, index) => this.playTone(frequency, frequency, 0.3, 0.16, "triangle", index * 0.15));
  }

  gameEnd(): void { this.playTone(440, 110, 0.7, 0.28, "sine"); }

  private playTone(from: number, to: number, duration: number, volume: number, type: OscillatorType, delay = 0): void {
    const ctx = this.ctx;
    const output = this.effectsOutput();
    if (!ctx || !output) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(Math.max(0.001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    writeStorage("hs_audio_muted", enabled ? "false" : "true");
    this.applyGain();
    this.emit();
  }

  setEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled = enabled;
    writeStorage("hs_audio_effects_muted", enabled ? "false" : "true");
    this.applyGain();
    this.emit();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    writeStorage("hs_audio_music_muted", enabled ? "false" : "true");
    this.applyGain();
    this.emit();
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clampVolume(volume);
    writeStorage("hs_audio_master", String(this.masterVolume));
    this.applyGain();
    this.emit();
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = clampVolume(volume);
    writeStorage("hs_audio_effects", String(this.effectsVolume));
    this.applyGain();
    this.emit();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    writeStorage("hs_audio_music", String(this.musicVolume));
    this.applyGain();
    this.emit();
  }

  settings(): AudioSettings {
    return {
      muted: !this.enabled,
      musicMuted: !this.musicEnabled,
      effectsMuted: !this.effectsEnabled,
      master: this.masterVolume,
      effects: this.effectsVolume,
      music: this.musicVolume,
    };
  }

  subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const settings = this.settings();
    for (const listener of this.listeners) listener(settings);
  }

  isEnabled(): boolean { return this.enabled; }
  isUnlocked(): boolean { return this.unlocked; }
}

export const soundManager = new SoundManager();

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.75));
}

function readVolume(key: string, fallback: number): number {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
  } catch { return fallback; }
}

function readBoolean(key: string, fallback: boolean, inverse = false): boolean {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    const parsed = value === "true";
    return inverse ? !parsed : parsed;
  } catch { return fallback; }
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, value); } catch { /* Preferences remain in memory. */ }
}
