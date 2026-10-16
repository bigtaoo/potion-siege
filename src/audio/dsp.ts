// Small synthesis toolkit: everything writes into a Float32Array of mono samples. The music
// writes wrap around the end of the buffer, so a loop's tails fall into its start and the
// seam is silent by construction.

export const TAU = Math.PI * 2;

export const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** mulberry32: a seeded random source, so every render is the same sound. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Wave = 'sine' | 'tri' | 'saw' | 'square';

/** polyBLEP: takes the click out of a hard edge at phase `t` (0..1) for a step of `dt`. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** One sample of a waveform at phase `p` (0..1) and phase step `dt`. */
export function osc(wave: Wave, p: number, dt: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(p * TAU);
    case 'tri':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'saw':
      return 2 * p - 1 - blep(p, dt);
    case 'square': {
      let v = p < 0.5 ? 1 : -1;
      v += blep(p, dt);
      v -= blep((p + 0.5) % 1, dt);
      return v;
    }
  }
}

/** A state-variable filter (Simper's, stable at any cutoff), one sample at a time. Set the
 *  cutoff with `tune` (it costs a tan), then `step` as often as needed. */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  lp = 0;
  bp = 0;
  hp = 0;

  constructor(private readonly sr: number, cutoff = 1000, q = 0.7) {
    this.tune(cutoff, q);
  }

  tune(cutoff: number, q = 0.7): this {
    const g = Math.tan((Math.PI * Math.min(cutoff, this.sr * 0.45)) / this.sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    return this;
  }

  step(x: number): this {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return this;
  }
}

/** Filters re-tune every this many samples when their cutoff moves. */
const RETUNE = 32;

export interface Tone {
  /** Start, seconds. */
  at: number;
  /** Length, seconds; the tone fades out over its last few milliseconds. */
  dur: number;
  freq: number;
  /** Frequency at the end: an exponential glide from `freq`. */
  to?: number;
  wave?: Wave;
  gain?: number;
  attack?: number;
  /** Time constant of the exponential decay after the attack; Infinity holds. */
  decay?: number;
  /** Vibrato: rate in Hz and depth as a fraction of the frequency. */
  vib?: [number, number];
  /** A low-pass that closes from `cutoff[0]` to `cutoff[1]` Hz over the tone. */
  cutoff?: [number, number];
  /** Partials as [ratio, gain, decay factor] added on top (bells). */
  partials?: [number, number, number][];
}

/** Adds a tone into `out`, wrapping past the end when `wrap` is set. */
export function tone(out: Float32Array, sr: number, o: Tone, wrap = false): void {
  const n = Math.round(o.dur * sr);
  const start = Math.round(o.at * sr);
  const wave = o.wave ?? 'sine';
  const gain = o.gain ?? 0.5;
  const attackN = Math.max(1, Math.round((o.attack ?? 0.004) * sr));
  const decay = o.decay ?? Infinity;
  const fall = Math.exp(-1 / (decay * sr)); // the envelope's step after the attack
  const releaseN = Math.max(1, Math.round(Math.min(0.03, o.dur * 0.3) * sr));
  const glide = o.to ? Math.exp(Math.log(o.to / o.freq) / n) : 1;
  const filter = o.cutoff ? new Svf(sr, o.cutoff[0], 0.9) : null;
  const sweep = o.cutoff ? Math.pow(o.cutoff[1] / o.cutoff[0], RETUNE / n) : 1;
  let cut = o.cutoff ? o.cutoff[0] : 0;
  const parts = o.partials ?? [];
  const phases = parts.map(() => 0);
  const pAmp = parts.map(([, g]) => g);
  const pFall = parts.map(([, , dk]) => Math.exp(-dk / (Math.min(decay, 10) * sr)));
  const vibW = o.vib ? (TAU * o.vib[0]) / sr : 0;
  const vibRamp = Math.round(0.15 * sr);
  let p = 0;
  let f = o.freq;
  let env = 1;
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    let fi = f;
    if (o.vib) fi *= 1 + o.vib[1] * Math.sin(vibW * i) * Math.min(1, i / vibRamp);
    f *= glide;
    const dt = fi / sr;
    let v = osc(wave, p, dt);
    p += dt;
    if (p >= 1) p -= 1;
    for (let j = 0; j < parts.length; j++) {
      v += pAmp[j] * Math.sin(phases[j] * TAU);
      pAmp[j] *= pFall[j];
      phases[j] += dt * parts[j][0];
      if (phases[j] >= 1) phases[j] -= Math.floor(phases[j]);
    }
    if (filter) {
      if (i % RETUNE === 0) {
        filter.tune(cut, 0.9);
        cut *= sweep;
      }
      v = filter.step(v).lp;
    }
    let e: number;
    if (i < attackN) e = i / attackN;
    else {
      e = env;
      env *= fall;
    }
    const left = n - i;
    if (left < releaseN) e *= left / releaseN;
    out[idx] += v * e * gain;
  }
}

export interface Noise {
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  decay?: number;
  /** Band-pass centre over the noise (Hz), from the first to the last value, evenly. */
  band?: number[];
  q?: number;
  /** 'lp' | 'bp' | 'hp' of the filter; without `band` the noise is white. */
  mode?: 'lp' | 'bp' | 'hp';
  /** Amplitude flutter: rate in Hz and depth 0..1 (fizz, gusts). */
  flutter?: [number, number];
  seed?: number;
}

/** Adds filtered noise into `out`. */
export function noise(out: Float32Array, sr: number, o: Noise, wrap = false): void {
  const n = Math.round(o.dur * sr);
  const start = Math.round(o.at * sr);
  const r = rng(o.seed ?? 7);
  const gain = o.gain ?? 0.5;
  const attackN = Math.max(1, Math.round((o.attack ?? 0.002) * sr));
  const fall = Math.exp(-1 / ((o.decay ?? Infinity) * sr));
  const releaseN = Math.max(1, Math.round(Math.min(0.03, o.dur * 0.3) * sr));
  const band = o.band;
  const q = o.q ?? 1;
  const f = new Svf(sr, band?.[0] ?? 1000, q);
  const mode = o.mode ?? 'bp';
  const fl = o.flutter;
  let env = 1;
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    let v = r() * 2 - 1;
    if (band) {
      if (band.length > 1 && i % RETUNE === 0) {
        const pos = (i / n) * (band.length - 1);
        const k = Math.floor(pos);
        f.tune(band[k] + (band[Math.min(k + 1, band.length - 1)] - band[k]) * (pos - k), q);
      }
      f.step(v);
      v = mode === 'lp' ? f.lp : mode === 'hp' ? f.hp : f.bp;
    }
    let e: number;
    if (i < attackN) e = i / attackN;
    else {
      e = env;
      env *= fall;
    }
    const left = n - i;
    if (left < releaseN) e *= left / releaseN;
    if (fl) {
      const t = i / sr;
      e *= 1 - fl[1] * (0.5 + 0.5 * Math.sin(TAU * fl[0] * t + Math.sin(t * 37) * 2));
    }
    out[idx] += v * e * gain;
  }
}

/** A plucked string (Karplus-Strong): harp and lute notes. `bright` 0..1. */
export function pluck(out: Float32Array, sr: number, at: number, freq: number, dur: number, gain: number, bright = 0.6, seed = 1, wrap = false): void {
  const period = Math.max(2, Math.round(sr / freq));
  const line = new Float32Array(period);
  const r = rng(seed);
  let lp = 0;
  for (let i = 0; i < period; i++) {
    lp += (r() * 2 - 1 - lp) * (0.15 + bright * 0.85);
    line[i] = lp;
  }
  // remove the offset so the string rings around zero
  const mean = line.reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) line[i] -= mean;
  // loss per round trip so the note falls about 50 dB over `dur`
  const trips = (dur * sr) / period;
  const loss = Math.pow(10, -2.5 / Math.max(1, trips));
  const n = Math.round(dur * sr);
  const start = Math.round(at * sr);
  const release = Math.min(0.04, dur * 0.2);
  let k = 0;
  for (let i = 0; i < n; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    const next = (k + 1) % period;
    const v = line[k];
    line[k] = 0.5 * (line[k] + line[next]) * loss;
    k = next;
    const left = (n - i) / sr;
    out[idx] += v * gain * (left < release ? left / release : 1) * Math.min(1, i / (sr * 0.002));
  }
}

/** Circular feedback comb + allpass reverb over a loop: run twice so the tail of the end
 *  carries into the start. Returns the wet signal only. */
export function loopReverb(dry: Float32Array, sr: number, size = 1, damp = 0.4): Float32Array {
  const wet = new Float32Array(dry.length);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.round(s * sr * size));
  const fb = 0.78;
  for (const d of combs) {
    const line = new Float32Array(d);
    let k = 0;
    let lp = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < dry.length; i++) {
        const y = line[k];
        lp = y * (1 - damp) + lp * damp;
        line[k] = dry[i] + lp * fb;
        k = (k + 1) % d;
        if (pass === 1) wet[i] += y * 0.25;
      }
    }
  }
  for (const s of [0.005, 0.0017]) {
    const d = Math.round(s * sr);
    const line = new Float32Array(d);
    const copy = wet.slice();
    let k = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < copy.length; i++) {
        const buf = line[k];
        const x = copy[i];
        const y = -0.6 * x + buf;
        line[k] = x + 0.6 * y;
        k = (k + 1) % d;
        if (pass === 1) wet[i] = y;
      }
    }
  }
  return wet;
}

/** Soft-clips and scales so the loudest sample sits at `peak`. */
export function master(out: Float32Array, peak = 0.8, drive = 1.2): Float32Array {
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(out[i] * drive);
    max = Math.max(max, Math.abs(out[i]));
  }
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}
