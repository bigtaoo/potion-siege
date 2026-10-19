// The sound effects, synthesized: each one is a recipe that fills a mono buffer. Rendered once
// per sound on first use and kept as an AudioBuffer.

import { master, midi, noise, pluck, rng, tone } from './dsp';

export const SFX_IDS = [
  'tap', 'summon', 'merge', 'levelup',
  'hitArcane', 'hitFire', 'hitIce', 'hitLightning', 'hitPoison', 'hitWind',
  'kill', 'boss', 'wallHit', 'wave', 'horde', 'win', 'lose', 'crystal', 'chest',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

export interface SfxSpec {
  /** Seconds. */
  len: number;
  /** Mix level, 0..1. */
  gain: number;
  /** At most this many playing at once; more are dropped. */
  limit: number;
  /** Minimum seconds between two starts. */
  gap: number;
  /** Random pitch spread, as a fraction (0.08: ±8 %). */
  vary: number;
  draw(out: Float32Array, sr: number): void;
}

const bell = (out: Float32Array, sr: number, at: number, note: number, gain: number, dur = 0.6): void =>
  tone(out, sr, { at, dur, freq: midi(note), gain, attack: 0.002, decay: dur / 3, partials: [[2.76, 0.35, 3], [5.4, 0.18, 6], [2, 0.2, 1.5]] });

/** A bubble: a sine that rises quickly as it pops. */
const bubble = (out: Float32Array, sr: number, at: number, f: number, gain: number, len = 0.07): void =>
  tone(out, sr, { at, dur: len, freq: f, to: f * 2.2, gain, attack: 0.003, decay: len / 2.5 });

export const SFX: Record<SfxId, SfxSpec> = {
  // a soft wooden knock
  tap: {
    len: 0.09, gain: 0.45, limit: 2, gap: 0.04, vary: 0.04,
    draw(o, sr) {
      tone(o, sr, { at: 0, dur: 0.08, freq: 820, to: 520, gain: 0.7, attack: 0.001, decay: 0.018 });
      noise(o, sr, { at: 0, dur: 0.02, gain: 0.25, decay: 0.004, band: [2600], q: 1.5 });
    },
  },
  // a rising glassy shimmer and a cork pop
  summon: {
    len: 0.5, gain: 0.5, limit: 2, gap: 0.06, vary: 0.03,
    draw(o, sr) {
      noise(o, sr, { at: 0, dur: 0.035, gain: 0.35, decay: 0.008, band: [1400], q: 2 });
      [72, 76, 79, 84].forEach((n, i) => bell(o, sr, 0.03 + i * 0.055, n, 0.22, 0.4));
      tone(o, sr, { at: 0.02, dur: 0.3, freq: 300, to: 900, gain: 0.25, wave: 'tri', decay: 0.1 });
    },
  },
  // potions poured together: a burst of bubbles, then a chime
  merge: {
    len: 0.75, gain: 0.55, limit: 2, gap: 0.08, vary: 0.04,
    draw(o, sr) {
      const r = rng(11);
      for (let i = 0; i < 11; i++) {
        const at = 0.02 * i + r() * 0.03;
        bubble(o, sr, at, 260 + r() * 420 + i * 30, 0.35 + r() * 0.2, 0.05 + r() * 0.05);
      }
      noise(o, sr, { at: 0, dur: 0.3, gain: 0.12, decay: 0.12, band: [600, 1800], q: 1.2 });
      bell(o, sr, 0.26, 79, 0.28, 0.45);
      bell(o, sr, 0.32, 84, 0.24, 0.42);
    },
  },
  // a skill learned: a bright rising arpeggio
  levelup: {
    len: 0.9, gain: 0.55, limit: 1, gap: 0.15, vary: 0,
    draw(o, sr) {
      [67, 71, 74, 79, 83].forEach((n, i) => {
        bell(o, sr, i * 0.07, n, 0.22, 0.6);
        tone(o, sr, { at: i * 0.07, dur: 0.18, freq: midi(n), wave: 'tri', gain: 0.12, decay: 0.08 });
      });
      tone(o, sr, { at: 0.35, dur: 0.5, freq: midi(91), gain: 0.06, decay: 0.2, vib: [7, 0.01] });
    },
  },
  // arcane: a short falling zap
  hitArcane: {
    len: 0.16, gain: 0.2, limit: 3, gap: 0.035, vary: 0.12,
    draw(o, sr) {
      tone(o, sr, { at: 0, dur: 0.15, freq: 1500, to: 420, wave: 'square', gain: 0.35, decay: 0.05, vib: [45, 0.04], cutoff: [5000, 1500] });
      tone(o, sr, { at: 0, dur: 0.1, freq: 2200, to: 1300, gain: 0.2, decay: 0.03 });
    },
  },
  // fire: a whoosh
  hitFire: {
    len: 0.3, gain: 0.26, limit: 3, gap: 0.05, vary: 0.12,
    draw(o, sr) {
      noise(o, sr, { at: 0, dur: 0.3, gain: 0.9, attack: 0.03, decay: 0.08, band: [500, 1600, 700], q: 0.9, seed: 3 });
      noise(o, sr, { at: 0, dur: 0.18, gain: 0.35, attack: 0.01, decay: 0.05, band: [220], mode: 'lp', seed: 4 });
    },
  },
  // ice: a crack and a few glassy tinkles
  hitIce: {
    len: 0.3, gain: 0.2, limit: 3, gap: 0.04, vary: 0.1,
    draw(o, sr) {
      noise(o, sr, { at: 0, dur: 0.04, gain: 0.8, decay: 0.008, band: [3500], mode: 'hp', seed: 5 });
      [[2400, 0.01], [3650, 0.035], [5100, 0.06]].forEach(([f, at]) =>
        tone(o, sr, { at, dur: 0.22, freq: f, gain: 0.16, attack: 0.001, decay: 0.05 }));
    },
  },
  // lightning: a crackle of sparks over a buzz
  hitLightning: {
    len: 0.22, gain: 0.2, limit: 3, gap: 0.04, vary: 0.1,
    draw(o, sr) {
      const r = rng(9);
      for (let i = 0; i < 9; i++) {
        noise(o, sr, { at: r() * 0.15, dur: 0.012, gain: 0.5 + r() * 0.4, decay: 0.003, band: [2500 + r() * 3000], q: 0.8, seed: 20 + i });
      }
      tone(o, sr, { at: 0, dur: 0.2, freq: 110, wave: 'saw', gain: 0.22, decay: 0.06, cutoff: [3000, 800] });
    },
  },
  // corrosion: a fizz with little bubbles
  hitPoison: {
    len: 0.35, gain: 0.2, limit: 3, gap: 0.05, vary: 0.12,
    draw(o, sr) {
      noise(o, sr, { at: 0, dur: 0.34, gain: 0.5, attack: 0.02, decay: 0.12, band: [5000], mode: 'hp', flutter: [38, 0.7], seed: 6 });
      const r = rng(13);
      for (let i = 0; i < 4; i++) bubble(o, sr, 0.03 + i * 0.06 + r() * 0.02, 500 + r() * 400, 0.18, 0.05);
    },
  },
  // wind: a soft gust
  hitWind: {
    len: 0.45, gain: 0.24, limit: 3, gap: 0.06, vary: 0.12,
    draw(o, sr) {
      noise(o, sr, { at: 0, dur: 0.45, gain: 1, attack: 0.12, decay: 0.12, band: [350, 900, 500], q: 1.6, flutter: [6, 0.3], seed: 8 });
    },
  },
  // a clockwork soldier falls apart: a metal clank, springs and a ratchet
  kill: {
    len: 0.45, gain: 0.32, limit: 3, gap: 0.05, vary: 0.1,
    draw(o, sr) {
      tone(o, sr, { at: 0, dur: 0.35, freq: 410, gain: 0.35, attack: 0.001, decay: 0.07, partials: [[2.76, 0.6, 4], [5.4, 0.4, 7], [8.93, 0.25, 10]] });
      noise(o, sr, { at: 0, dur: 0.05, gain: 0.5, decay: 0.01, band: [1800], q: 1, seed: 2 });
      for (let i = 0; i < 4; i++) noise(o, sr, { at: 0.09 + i * 0.045, dur: 0.012, gain: 0.35 - i * 0.06, decay: 0.003, band: [3200], q: 2, seed: 30 + i });
      tone(o, sr, { at: 0, dur: 0.15, freq: 140, to: 70, gain: 0.3, decay: 0.04 });
    },
  },
  // the boss arrives: a low horn, a gong and grinding gears
  boss: {
    len: 2.2, gain: 0.6, limit: 1, gap: 1, vary: 0,
    draw(o, sr) {
      for (const [n, g] of [[38, 0.3], [45, 0.22], [50, 0.12]] as const) {
        tone(o, sr, { at: 0, dur: 1.9, freq: midi(n), wave: 'saw', gain: g, attack: 0.35, decay: 1.2, cutoff: [500, 1400], vib: [5, 0.006] });
      }
      tone(o, sr, { at: 0, dur: 2.1, freq: 98, gain: 0.35, attack: 0.002, decay: 0.7, partials: [[1.47, 0.5, 1.2], [2.09, 0.35, 1.6], [2.56, 0.25, 2], [3.9, 0.15, 3]] });
      for (let i = 0; i < 10; i++) noise(o, sr, { at: 0.3 + i * 0.11, dur: 0.015, gain: 0.25, decay: 0.004, band: [1500], q: 2.5, seed: 50 + i });
    },
  },
  // the wall takes a blow: a dull stone thud
  wallHit: {
    len: 0.3, gain: 0.45, limit: 2, gap: 0.12, vary: 0.08,
    draw(o, sr) {
      tone(o, sr, { at: 0, dur: 0.25, freq: 130, to: 48, gain: 0.8, attack: 0.002, decay: 0.07 });
      noise(o, sr, { at: 0, dur: 0.12, gain: 0.5, decay: 0.03, band: [380], mode: 'lp', seed: 12 });
    },
  },
  // a wave starts: a brass call over a clock bell
  wave: {
    len: 1.1, gain: 0.45, limit: 1, gap: 0.5, vary: 0,
    draw(o, sr) {
      const horn = (at: number, n: number, dur: number) =>
        tone(o, sr, { at, dur, freq: midi(n), wave: 'saw', gain: 0.22, attack: 0.03, decay: 0.6, cutoff: [2600, 900], vib: [5.5, 0.004] });
      horn(0, 67, 0.22);
      horn(0.2, 72, 0.7);
      horn(0.2, 64, 0.7);
      bell(o, sr, 0, 84, 0.12, 0.9);
    },
  },
  // the horde of the first wave: war drums under two low horn calls, the second one higher
  horde: {
    len: 2, gain: 0.55, limit: 1, gap: 1, vary: 0,
    draw(o, sr) {
      const drum = (at: number, g: number, seed: number) => {
        tone(o, sr, { at, dur: 0.3, freq: 92, to: 46, gain: g, attack: 0.002, decay: 0.09 });
        noise(o, sr, { at, dur: 0.1, gain: g * 0.45, decay: 0.025, band: [260], mode: 'lp', seed });
      };
      [[0, 0.7], [0.25, 0.45], [0.5, 0.7], [0.62, 0.4], [0.75, 0.55], [1.1, 0.75], [1.35, 0.5], [1.6, 0.8]].forEach(([at, g], i) => drum(at, g, 60 + i));
      const horn = (at: number, n: number, dur: number, g: number) =>
        tone(o, sr, { at, dur, freq: midi(n), wave: 'saw', gain: g, attack: 0.08, decay: 0.9, cutoff: [700, 1800], vib: [5, 0.006] });
      horn(0.05, 43, 0.75, 0.22);
      horn(0.05, 50, 0.75, 0.14);
      horn(0.9, 48, 1.0, 0.24);
      horn(0.9, 55, 1.0, 0.16);
    },
  },
  // victory: a little brass fanfare and bells
  win: {
    len: 2.3, gain: 0.6, limit: 1, gap: 1, vary: 0,
    draw(o, sr) {
      const horn = (at: number, n: number, dur: number, g = 0.2) =>
        tone(o, sr, { at, dur, freq: midi(n), wave: 'saw', gain: g, attack: 0.02, decay: dur * 1.5, cutoff: [3200, 1300], vib: [5.5, 0.005] });
      [[0, 67, 0.14], [0.15, 67, 0.14], [0.3, 67, 0.14], [0.45, 72, 0.45], [0.95, 71, 0.2], [1.15, 74, 0.2]].forEach(([at, n, d]) => horn(at, n, d));
      horn(1.35, 79, 0.9, 0.22);
      horn(1.35, 76, 0.9, 0.16);
      horn(1.35, 72, 0.9, 0.16);
      tone(o, sr, { at: 1.35, dur: 0.9, freq: midi(48), wave: 'tri', gain: 0.3, decay: 0.6 });
      [84, 88, 91, 96].forEach((n, i) => bell(o, sr, 1.35 + i * 0.08, n, 0.1, 0.8));
    },
  },
  // defeat: a falling minor sting
  lose: {
    len: 2, gain: 0.55, limit: 1, gap: 1, vary: 0,
    draw(o, sr) {
      [[0, 67], [0.3, 63], [0.6, 60]].forEach(([at, n]) =>
        tone(o, sr, { at, dur: 0.5, freq: midi(n), wave: 'tri', gain: 0.35, attack: 0.02, decay: 0.4, vib: [5, 0.008] }));
      tone(o, sr, { at: 0.9, dur: 1.05, freq: midi(59), to: midi(55), wave: 'saw', gain: 0.18, attack: 0.05, decay: 0.7, cutoff: [1600, 500], vib: [4.5, 0.012] });
      tone(o, sr, { at: 0.9, dur: 1.05, freq: midi(36), wave: 'tri', gain: 0.35, decay: 0.6 });
      bell(o, sr, 0.9, 72, 0.08, 1);
    },
  },
  // crystals: a scatter of high chimes
  crystal: {
    len: 0.8, gain: 0.45, limit: 2, gap: 0.08, vary: 0.02,
    draw(o, sr) {
      [88, 91, 93, 96, 100].forEach((n, i) => bell(o, sr, i * 0.05, n, 0.18 - i * 0.015, 0.55));
      noise(o, sr, { at: 0, dur: 0.3, gain: 0.06, decay: 0.12, band: [8000], mode: 'hp', seed: 15 });
    },
  },
  // the chest: a creaking lid, a pop, a shower of sparkle
  chest: {
    len: 1.3, gain: 0.55, limit: 1, gap: 0.5, vary: 0,
    draw(o, sr) {
      for (let i = 0; i < 14; i++) noise(o, sr, { at: i * 0.018, dur: 0.02, gain: 0.25, decay: 0.006, band: [500 + i * 25], q: 6, seed: 70 + i });
      tone(o, sr, { at: 0.28, dur: 0.12, freq: 200, to: 700, gain: 0.4, decay: 0.03 });
      noise(o, sr, { at: 0.28, dur: 0.05, gain: 0.3, decay: 0.012, band: [1200], seed: 16 });
      [79, 83, 86, 91, 95, 98].forEach((n, i) => bell(o, sr, 0.34 + i * 0.06, n, 0.15, 0.7));
      for (let i = 0; i < 5; i++) pluck(o, sr, 0.34 + i * 0.06, midi([67, 71, 74, 79, 83][i]), 0.6, 0.18, 0.7, 90 + i);
    },
  },
};

/** Renders one sound effect at `sr` samples a second, peak-normalized to its mix level. */
export function renderSfx(id: SfxId, sr: number): Float32Array {
  const spec = SFX[id];
  const out = new Float32Array(Math.ceil(spec.len * sr));
  spec.draw(out, sr);
  return master(out, 0.9 * spec.gain, 1);
}
