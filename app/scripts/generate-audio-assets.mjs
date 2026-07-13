import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "public", "audio");
const RATE = 22_050;

await mkdir(OUTPUT, { recursive: true });

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0xffff_ffff;
  };
}

function envelope(time, start, length, attack = 0.008, release = 0.18) {
  const local = time - start;
  if (local < 0 || local >= length) return 0;
  return Math.min(1, local / attack) * Math.min(1, (length - local) / release);
}

function tone(time, frequency, type = "sine") {
  const phase = Math.PI * 2 * frequency * time;
  if (type === "triangle") return 2 * Math.asin(Math.sin(phase)) / Math.PI;
  if (type === "softSquare") return Math.tanh(Math.sin(phase) * 2.2);
  return Math.sin(phase);
}

function noteHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function normalize(samples, peak = 0.82) {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  const scale = max ? peak / max : 1;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= scale;
  return samples;
}

function render(duration, renderer, seed = 1) {
  const samples = new Float32Array(Math.floor(duration * RATE));
  const random = seeded(seed);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / RATE;
    const edge = Math.min(1, time / 0.02, (duration - time) / 0.03);
    samples[index] = renderer(time, random) * Math.max(0, edge);
  }
  return normalize(samples);
}

function wav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), 44 + index * 2);
  }
  return bytes;
}

async function save(name, samples) {
  await writeFile(resolve(OUTPUT, name), wav(samples));
}

// Eight-bar original reserve cue: kalimba-like plucks over a soft breathing pad.
const reserveDuration = 16;
const reserveChords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
await save("reserve-theme.wav", render(reserveDuration, (time, random) => {
  const beat = 0.5;
  const chord = reserveChords[Math.floor(time / 4) % reserveChords.length];
  let sample = 0;
  for (const midi of chord) {
    sample += tone(time, noteHz(midi - 12)) * 0.055;
    sample += tone(time, noteHz(midi), "triangle") * 0.018;
  }
  const step = Math.floor(time / beat);
  const start = step * beat;
  const melody = [0, 2, 1, 2, 0, 1, 2, 1][step % 8];
  const pluckEnv = envelope(time, start, 0.42, 0.005, 0.34);
  const frequency = noteHz(chord[melody] + 12);
  sample += (tone(time - start, frequency, "triangle") * 0.16 + tone(time - start, frequency * 2) * 0.055) * pluckEnv;
  const shakerPhase = time % 0.25;
  if (shakerPhase < 0.045) sample += (random() * 2 - 1) * (1 - shakerPhase / 0.045) * 0.035;
  return sample;
}, 0x51a7));

// Sixteen-beat original stadium cue: punchy low-end, claps, and a bright call-and-response lead.
const soccerDuration = 12;
const soccerBass = [45, 45, 48, 43, 45, 45, 52, 50];
const soccerLead = [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 71];
await save("soccer-theme.wav", render(soccerDuration, (time, random) => {
  const beat = 0.375;
  const step = Math.floor(time / beat);
  const local = time - step * beat;
  const bassEnv = envelope(time, step * beat, 0.31, 0.004, 0.16);
  const bass = tone(local, noteHz(soccerBass[step % soccerBass.length]), "softSquare") * bassEnv * 0.16;
  const leadEnv = envelope(time, step * beat, step % 4 === 3 ? 0.28 : 0.18, 0.004, 0.12);
  const lead = (tone(local, noteHz(soccerLead[step % soccerLead.length]), "triangle") + tone(local, noteHz(soccerLead[step % soccerLead.length]) * 2) * 0.25) * leadEnv * 0.12;
  const kick = local < 0.12 && step % 2 === 0 ? tone(local, 105 - local * 600) * Math.pow(1 - local / 0.12, 3) * 0.38 : 0;
  const clap = local < 0.09 && step % 4 === 2 ? (random() * 2 - 1) * Math.pow(1 - local / 0.09, 2) * 0.17 : 0;
  return bass + lead + kick + clap;
}, 0x50cc3));

const surfaces = {
  grass: { seed: 0x6101, base: 118, noise: 0.18, click: 0.04 },
  forest: { seed: 0xf071, base: 92, noise: 0.13, click: 0.12 },
  sand: { seed: 0x5a2d, base: 70, noise: 0.23, click: 0.025 },
  rock: { seed: 0x70c4, base: 185, noise: 0.07, click: 0.22 },
  water: { seed: 0xa73f, base: 64, noise: 0.25, click: 0.02 },
};

for (const [surface, settings] of Object.entries(surfaces)) {
  await save(`step-${surface}.wav`, render(0.28, (time, random) => {
    const decay = Math.exp(-time * 16);
    const impact = tone(time, settings.base - time * 55) * decay * 0.22;
    const texture = (random() * 2 - 1) * Math.exp(-time * 11) * settings.noise;
    const click = tone(time, settings.base * 5, "triangle") * Math.exp(-time * 42) * settings.click;
    const splash = surface === "water" ? tone(time, 310 + Math.sin(time * 33) * 80) * Math.exp(-time * 8) * 0.1 : 0;
    return impact + texture + click + splash;
  }, settings.seed));
}

await save("shot.wav", render(0.34, (time, random) => {
  const crack = (random() * 2 - 1) * Math.exp(-time * 24) * 0.7;
  const body = tone(time, 115 - time * 180) * Math.exp(-time * 13) * 0.5;
  const tail = (random() * 2 - 1) * Math.exp(-time * 7) * 0.13;
  return crack + body + tail;
}, 0x5a07));

await save("ui-confirm.wav", render(0.22, (time) => {
  const first = tone(time, noteHz(72), "triangle") * envelope(time, 0, 0.13, 0.004, 0.08);
  const second = tone(time - 0.075, noteHz(79), "triangle") * envelope(time, 0.075, 0.14, 0.004, 0.09);
  return (first + second) * 0.42;
}, 0xc0f1));

console.log(`Generated original audio assets in ${OUTPUT}`);
