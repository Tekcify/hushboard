import { loadSettings } from "./settings";

interface Engine {
  ctx: AudioContext;
  bus: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;
let unlockArmed = false;

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function build(): Engine | null {
  if (engine) return engine;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor({ latencyHint: "interactive" });
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const bus = ctx.createGain();
  bus.connect(master);
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 1.6, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  bus.connect(room).connect(wet).connect(master);
  engine = { ctx, bus, noise: whiteNoise(ctx, 1.5) };
  return engine;
}

async function ready(): Promise<Engine | null> {
  if (!loadSettings().sound) return null;
  const e = build();
  if (!e) return null;
  if (e.ctx.state !== "running") {
    await Promise.race([e.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
  }
  if (e.ctx.state !== "running") {
    armUnlock(e.ctx);
    return null;
  }
  return e;
}

function armUnlock(ctx: AudioContext) {
  if (unlockArmed) return;
  unlockArmed = true;
  const go = () => {
    void ctx.resume();
    unlockArmed = false;
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}

function tap(e: Engine, at: number, level: number) {
  const { ctx, bus, noise } = e;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  src.connect(band).connect(g).connect(bus);
  src.start(at, Math.random() * 0.5, 0.06);

  const thock = ctx.createOscillator();
  thock.type = "sine";
  thock.frequency.setValueAtTime(200, at);
  thock.frequency.exponentialRampToValueAtTime(85, at + 0.07);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, at);
  tg.gain.exponentialRampToValueAtTime(level * 0.55, at + 0.004);
  tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  thock.connect(tg).connect(bus);
  thock.start(at);
  thock.stop(at + 0.1);
}

function bell(e: Engine, at: number, freq: number, level: number, seconds: number) {
  const { ctx, bus } = e;
  const tone = ctx.createGain();
  tone.gain.setValueAtTime(0.0001, at);
  tone.gain.exponentialRampToValueAtTime(level, at + 0.012);
  tone.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 4200;
  tone.connect(soft).connect(bus);
  const partials: [number, number, OscillatorType][] = [
    [1, 1, "sine"],
    [2.01, 0.22, "sine"],
    [3, 0.06, "sine"],
  ];
  for (const [ratio, mix, type] of partials) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * ratio;
    const m = ctx.createGain();
    m.gain.value = mix;
    o.connect(m).connect(tone);
    o.start(at);
    o.stop(at + seconds + 0.05);
  }
}

function hush(e: Engine, at: number, seconds: number, level: number) {
  const { ctx, bus, noise } = e;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 1800;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(3600, at);
  band.frequency.exponentialRampToValueAtTime(5200, at + seconds);
  band.Q.value = 0.55;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + seconds * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(high).connect(band).connect(g).connect(bus);
  src.start(at, 0, seconds + 0.05);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export async function playLaunch(): Promise<void> {
  const e = await ready();
  if (!e) return;
  const t = e.ctx.currentTime + 0.03;
  tap(e, t, 0.32);
  bell(e, t + 0.11, C5, 0.15, 1.1);
  bell(e, t + 0.23, G5, 0.12, 1.3);
  hush(e, t + 0.12, 0.9, 0.045);
}

export async function playStep(): Promise<void> {
  const e = await ready();
  if (!e) return;
  tap(e, e.ctx.currentTime + 0.01, 0.2);
}

export async function playOn(): Promise<void> {
  const e = await ready();
  if (!e) return;
  const t = e.ctx.currentTime + 0.01;
  tap(e, t, 0.14);
  bell(e, t + 0.04, G5, 0.06, 0.35);
}

export async function playDone(): Promise<void> {
  const e = await ready();
  if (!e) return;
  const t = e.ctx.currentTime + 0.02;
  tap(e, t, 0.2);
  bell(e, t + 0.08, C5, 0.11, 1.4);
  bell(e, t + 0.15, E5, 0.1, 1.5);
  bell(e, t + 0.22, G5, 0.1, 1.6);
  bell(e, t + 0.34, C6, 0.06, 1.8);
}
