// The two music loops, composed in code and rendered into one mono buffer each. Every note is
// written with wrap-around and the reverb runs over the loop twice, so the end flows into the
// start without a seam.

import { loopReverb, master, midi, noise, pluck, rng, Svf, tone } from './dsp';

export type TrackId = 'workshop' | 'battle';
export const TRACK_IDS: readonly TrackId[] = ['workshop', 'battle'];

/** Music is rendered at a modest rate: it is soft and mono, and it halves the work. */
export const MUSIC_RATE = 22050;

const CHORDS: Record<string, number[]> = {
  C: [60, 64, 67],
  Dm: [62, 65, 69],
  Em: [64, 67, 71],
  E: [64, 68, 71],
  F: [65, 69, 72],
  G: [67, 71, 74],
  Am: [69, 72, 76],
};

/** "E5:1 G5:1.5 r:.5" -> [beat, midi, beats][]; `r` is a rest. */
function melody(src: string): [number, number, number][] {
  const out: [number, number, number][] = [];
  let beat = 0;
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const [name, len] = tok.split(':');
    const beats = Number(len);
    if (name !== 'r') {
      const m = /^([A-G])(#?)(\d)$/.exec(name);
      if (!m) throw new Error(`bad note ${name}`);
      const step = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
      out.push([beat, 12 * (Number(m[3]) + 1) + step + (m[2] ? 1 : 0), beats]);
    }
    beat += beats;
  }
  return out;
}

export interface Song {
  bpm: number;
  chords: string[];
  render(out: Float32Array, sr: number, beat: number): void;
}

const WORKSHOP: Song = {
  bpm: 80,
  chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G'],
  render(out, sr, beat) {
    const bar = beat * 4;
    const tune = melody(`
      E5:1 G5:1 C6:1.5 B5:.5 | A5:2 E5:1 r:1 | F5:1 A5:1 C6:1 A5:1 | G5:3 r:1 |
      E5:1 G5:1 C6:1 D6:1 | E6:1.5 D6:.5 B5:2 | A5:1 C6:1 F5:1 A5:1 | G5:2 B5:1 D6:1 |
      C6:1.5 B5:.5 A5:2 | G5:1 B5:1 E5:2 | F5:1 A5:1 C6:1 F6:1 | E6:2 C6:2 |
      D6:1 C6:1 A5:1 F5:1 | G5:1 B5:1 D6:1 B5:1 | C6:3 r:1 | r:2 G5:1 B5:1`);
    this.chords.forEach((name, i) => {
      const ch = CHORDS[name];
      const t0 = i * bar;
      // a warm pad, breathing in and out with each bar
      for (const n of ch) {
        for (const det of [-0.004, 0.004]) {
          tone(out, sr, { at: t0, dur: bar + 0.6, freq: midi(n - 12) * (1 + det), wave: 'tri', gain: 0.035, attack: 0.9, decay: 3, cutoff: [1400, 900] }, true);
        }
      }
      // a soft bass on beats one and three
      for (const b of [0, 2]) tone(out, sr, { at: t0 + b * beat, dur: beat * 1.9, freq: midi(ch[0] - 24), gain: 0.2, attack: 0.02, decay: 0.9 }, true);
      // the harp: eighths across the chord
      const arp = [ch[0] - 12, ch[2] - 12, ch[1], ch[2] - 12, ch[0], ch[2] - 12, ch[1], ch[2] - 12];
      arp.forEach((n, k) => pluck(out, sr, t0 + k * beat * 0.5, midi(n), 1.6, k % 2 ? 0.09 : 0.12, 0.45, i * 8 + k, true));
    });
    // the music box tune
    for (const [b, n, len] of tune) {
      tone(out, sr, { at: b * beat, dur: Math.max(0.8, len * beat + 0.5), freq: midi(n), gain: 0.1, attack: 0.003, decay: 0.45, partials: [[2, 0.25, 2], [4.2, 0.12, 4], [6.8, 0.05, 6]] }, true);
    }
    // the workshop clock, quietly, on every beat
    const beats = this.chords.length * 4;
    for (let k = 0; k < beats; k++) {
      noise(out, sr, { at: k * beat, dur: 0.02, gain: k % 2 ? 0.04 : 0.055, decay: 0.004, band: [k % 2 ? 1900 : 2600], q: 4, seed: 300 + (k % 2) }, true);
    }
  },
};

const BATTLE: Song = {
  bpm: 116,
  chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'G', 'Am', 'F', 'E', 'E'],
  render(out, sr, beat) {
    const bar = beat * 4;
    const lead = melody(`
      r:4 | r:4 | r:4 | r:2 E5:.5 F5:.5 G5:1 |
      A5:1.5 E5:.5 A5:1 C6:1 | C6:1.5 A5:.5 F5:2 | G5:1 B5:1 D6:1 B5:1 | G#5:3 E5:1 |
      F5:1.5 A5:.5 D6:2 | C6:1 B5:.5 A5:.5 E5:2 | F5:1 A5:1 C6:1 D6:1 | B5:2 G5:1 B5:1 |
      C6:1.5 B5:.5 A5:1 E6:1 | C6:1 A5:1 F5:1 A5:1 | G#5:1 B5:1 E6:2 | D6:1 B5:1 G#5:1 E5:1`);
    const r = rng(77);
    this.chords.forEach((name, i) => {
      const ch = CHORDS[name];
      const t0 = i * bar;
      // a low string pad
      for (const n of ch) {
        tone(out, sr, { at: t0, dur: bar + 0.3, freq: midi(n - 12), wave: 'saw', gain: 0.022, attack: 0.25, decay: 4, cutoff: [900, 700] }, true);
      }
      // a driving bass in eighths, the octave on the offbeats
      for (let k = 0; k < 8; k++) {
        const n = ch[0] - 24 + (k % 2 && k !== 7 ? 12 : 0);
        tone(out, sr, { at: t0 + k * beat * 0.5, dur: beat * 0.45, freq: midi(n), wave: 'saw', gain: 0.16, attack: 0.004, decay: 0.12, cutoff: [1300, 300] }, true);
      }
      // the lute: sixteenths up and down the chord
      const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
      for (let k = 0; k < 16; k++) {
        pluck(out, sr, t0 + k * beat * 0.25, midi(arp[k % arp.length]), 0.45, k % 4 === 0 ? 0.08 : 0.05, 0.7, i * 16 + k, true);
      }
      // drums: kick on one, the and of two and three; a snare on two and four
      for (const b of [0, 1.5, 2]) {
        tone(out, sr, { at: t0 + b * beat, dur: 0.3, freq: 150, to: 45, gain: 0.55, attack: 0.001, decay: 0.09 }, true);
      }
      for (const b of [1, 3]) {
        noise(out, sr, { at: t0 + b * beat, dur: 0.2, gain: 0.28, decay: 0.05, band: [1900], q: 0.7, seed: 400 + i * 2 + b }, true);
        tone(out, sr, { at: t0 + b * beat, dur: 0.1, freq: 210, to: 160, gain: 0.18, decay: 0.03 }, true);
      }
      // clockwork hats: tick-tock eighths, a little swing in the level
      for (let k = 0; k < 8; k++) {
        noise(out, sr, { at: t0 + k * beat * 0.5, dur: 0.03, gain: k % 2 ? 0.07 : 0.045, decay: 0.006, band: [k % 2 ? 7000 : 5200], mode: 'hp', seed: 500 + Math.floor(r() * 50) }, true);
      }
      // a crash where each four-bar phrase starts
      if (i % 4 === 0) noise(out, sr, { at: t0, dur: 1.4, gain: 0.08, decay: 0.45, band: [6000], mode: 'hp', seed: 600 + i }, true);
    });
    // the brass lead, doubled by a soft square an octave down
    for (const [b, n, len] of lead) {
      const dur = len * beat * 0.95;
      tone(out, sr, { at: b * beat, dur, freq: midi(n), wave: 'saw', gain: 0.075, attack: 0.025, decay: 1.2, cutoff: [3200, 1500], vib: [5.5, 0.006] }, true);
      tone(out, sr, { at: b * beat, dur, freq: midi(n - 12), wave: 'square', gain: 0.03, attack: 0.02, decay: 1, cutoff: [1500, 800] }, true);
    }
  },
};

export const SONGS: Record<TrackId, Song> = { workshop: WORKSHOP, battle: BATTLE };

/** The loop's length in seconds: whole bars of 4/4. */
export function songLength(id: TrackId): number {
  const s = SONGS[id];
  return (s.chords.length * 4 * 60) / s.bpm;
}

/** Renders a seamless loop of the track. */
export function renderMusic(id: TrackId, sr = MUSIC_RATE): Float32Array {
  const song = SONGS[id];
  const out = new Float32Array(Math.round(songLength(id) * sr));
  song.render(out, sr, 60 / song.bpm);
  // the first-order high-pass keeps the sum centred; run twice over the loop for continuity
  const hp = new Svf(sr, 30);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < out.length; i++) {
    const v = hp.step(out[i]).hp;
    if (pass === 1) out[i] = v;
  }
  const wet = loopReverb(out, sr, id === 'workshop' ? 1.3 : 0.9, 0.45);
  const mix = id === 'workshop' ? 0.35 : 0.2;
  for (let i = 0; i < out.length; i++) out[i] += wet[i] * mix;
  return master(out, 0.85, 1.4);
}
