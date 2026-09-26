import type { SoundName } from './types';

type Voice = (ctx: AudioContext, out: AudioNode, t: number) => void;

function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: { type?: OscillatorType; from: number; to?: number; dur: number; gain?: number; delay?: number },
): void {
  const start = t + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.from, start);
  if (opts.to !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), start + opts.dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + opts.dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  gain: number,
  cutoff: number,
): void {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, t);
  filter.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const arp =
  (notes: number[], step: number, type: OscillatorType, gain: number, dur = step * 1.6): Voice =>
  (ctx, out, t) =>
    notes.forEach((f, i) => tone(ctx, out, t, { type, from: f, dur, gain, delay: i * step }));

const note =
  (freq: number): Voice =>
  (ctx, out, t) => {
    tone(ctx, out, t, { type: 'triangle', from: freq, dur: 0.42, gain: 0.26 });
    tone(ctx, out, t, { type: 'sine', from: freq * 2, dur: 0.25, gain: 0.07 });
  };

const VOICES: Record<SoundName, Voice> = {
  click: (c, o, t) => tone(c, o, t, { from: 820, dur: 0.05, gain: 0.18 }),
  tap: (c, o, t) => tone(c, o, t, { type: 'triangle', from: 520, to: 640, dur: 0.07, gain: 0.25 }),
  score: arp([660, 990], 0.06, 'square', 0.12),
  coin: arp([988, 1319], 0.07, 'square', 0.1, 0.18),
  hit: (c, o, t) => {
    noise(c, o, t, 0.14, 0.35, 2200);
    tone(c, o, t, { from: 160, to: 60, dur: 0.14, gain: 0.35 });
  },
  miss: (c, o, t) => tone(c, o, t, { type: 'sawtooth', from: 320, to: 140, dur: 0.18, gain: 0.12 }),
  jump: (c, o, t) => tone(c, o, t, { type: 'square', from: 320, to: 680, dur: 0.12, gain: 0.1 }),
  shoot: (c, o, t) => tone(c, o, t, { type: 'square', from: 880, to: 220, dur: 0.08, gain: 0.06 }),
  explode: (c, o, t) => {
    noise(c, o, t, 0.45, 0.45, 1600);
    tone(c, o, t, { from: 90, to: 40, dur: 0.35, gain: 0.3 });
  },
  powerup: arp([523, 659, 784, 1047], 0.05, 'triangle', 0.18),
  perfect: (c, o, t) => {
    tone(c, o, t, { from: 1318, dur: 0.25, gain: 0.16 });
    tone(c, o, t, { from: 1760, dur: 0.3, gain: 0.1, delay: 0.05 });
  },
  gameover: arp([523, 415, 330, 262], 0.12, 'triangle', 0.2, 0.22),
  win: arp([523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.2, 0.2),
  levelup: arp([392, 523, 659, 784, 1047], 0.07, 'square', 0.09, 0.2),
  achievement: arp([1047, 1319, 1568, 2093], 0.06, 'sine', 0.16, 0.25),
  tick: (c, o, t) => tone(c, o, t, { from: 1400, dur: 0.025, gain: 0.08 }),
  swap: (c, o, t) => tone(c, o, t, { from: 420, to: 760, dur: 0.07, gain: 0.16 }),
  error: (c, o, t) => tone(c, o, t, { type: 'square', from: 150, to: 120, dur: 0.16, gain: 0.1 }),
  'note-c': note(523.25),
  'note-d': note(587.33),
  'note-e': note(659.25),
  'note-g': note(783.99),
  'note-a': note(880),
  'note-c2': note(1046.5),
};

/**
 * Tiny synthesized sound engine — no audio files to download. The
 * AudioContext is only created after a user gesture, so nothing can play
 * before the player interacts, and everything respects the sound setting.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 0.6;
  private lastPlayed = new Map<SoundName, number>();

  configure(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume * 0.8, this.ctx.currentTime, 0.02);
  }

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.8;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.03) return; // avoid stacking identical sounds in one frame
    this.lastPlayed.set(name, now);
    try {
      VOICES[name](this.ctx, this.master, now + 0.005);
    } catch {
      /* audio is best-effort */
    }
  }
}

export const sound = new SoundEngine();

export function haptic(enabled: boolean, pattern: number | number[]): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}
