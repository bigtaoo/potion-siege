import { describe, expect, it } from 'vitest';
import { parseMeta } from '../sim/meta';
import { battleCues } from './cues';
import { Mix, Throttle } from './mix';
import { MUSIC_RATE, renderMusic, songLength, TRACK_IDS } from './music';
import { renderSfx, SFX, SFX_IDS } from './sfx';

describe('throttle', () => {
  const rule = { limit: 3, gap: 0.03 };

  it('drops copies beyond the limit while they play', () => {
    const th = new Throttle();
    const started = [0, 0.05, 0.1, 0.15, 0.2].filter((t) => th.admit('hit', rule, t, 1));
    expect(started).toEqual([0, 0.05, 0.1]);
    expect(th.playing('hit', 0.2)).toBe(3);
  });

  it('lets a new copy in once an old one ends', () => {
    const th = new Throttle();
    for (const t of [0, 0.05, 0.1]) th.admit('hit', rule, t, 0.3);
    expect(th.admit('hit', rule, 0.2, 0.3)).toBe(false);
    expect(th.admit('hit', rule, 0.31, 0.3)).toBe(true);
    expect(th.playing('hit', 0.31)).toBe(3);
  });

  it('keeps starts apart by the gap', () => {
    const th = new Throttle();
    expect(th.admit('hit', rule, 1, 0.1)).toBe(true);
    expect(th.admit('hit', rule, 1.01, 0.1)).toBe(false);
    expect(th.admit('hit', rule, 1.04, 0.1)).toBe(true);
  });

  it('counts each sound on its own', () => {
    const th = new Throttle();
    const one = { limit: 1, gap: 0 };
    expect(th.admit('a', one, 0, 1)).toBe(true);
    expect(th.admit('b', one, 0, 1)).toBe(true);
    expect(th.admit('a', one, 0.5, 1)).toBe(false);
  });

  it('a mass of hits in one frame plays at most the limit of each', () => {
    const th = new Throttle();
    let played = 0;
    for (let i = 0; i < 200; i++) if (th.admit('hitFire', SFX.hitFire, 5, SFX.hitFire.len)) played++;
    expect(played).toBe(1); // the rest arrive inside the gap
    for (let f = 1; f <= 30; f++) for (let i = 0; i < 20; i++) th.admit('hitFire', SFX.hitFire, 5 + f / 60, SFX.hitFire.len);
    expect(th.playing('hitFire', 5.5)).toBeLessThanOrEqual(SFX.hitFire.limit);
  });
});

describe('mix', () => {
  it('starts with both toggles on and plays', () => {
    const m = new Mix();
    expect([m.musicLevel, m.sfxLevel, m.running]).toEqual([1, 1, true]);
  });

  it('the toggles act separately', () => {
    const m = new Mix();
    m.music = false;
    expect([m.musicLevel, m.sfxLevel, m.running]).toEqual([0, 1, true]);
    m.sfx = false;
    expect([m.musicLevel, m.sfxLevel, m.running]).toEqual([0, 0, false]);
    m.music = true;
    expect([m.musicLevel, m.sfxLevel]).toEqual([1, 0]);
  });

  it('an ad, the portal mute or a hidden tab silence everything, toggles kept', () => {
    for (const key of ['ad', 'host', 'hidden'] as const) {
      const m = new Mix();
      m[key] = true;
      expect([m.musicLevel, m.sfxLevel, m.running]).toEqual([0, 0, false]);
      expect([m.music, m.sfx]).toEqual([true, true]);
      m[key] = false;
      expect([m.musicLevel, m.sfxLevel, m.running]).toEqual([1, 1, true]);
    }
  });

  it('after an ad the player toggle still rules', () => {
    const m = new Mix();
    m.music = false;
    m.ad = true;
    m.ad = false;
    expect([m.musicLevel, m.sfxLevel]).toEqual([0, 1]);
  });
});

describe('the toggles in the save', () => {
  it('default on, and an old save without them gets them on', () => {
    expect(parseMeta(null).sound).toEqual({ music: true, sfx: true });
    expect(parseMeta(JSON.stringify({ runs: 3 })).sound).toEqual({ music: true, sfx: true });
  });

  it('round-trips', () => {
    const m = parseMeta(null);
    m.sound.music = false;
    expect(parseMeta(JSON.stringify(m)).sound).toEqual({ music: false, sfx: true });
    m.sound = { music: true, sfx: false };
    expect(parseMeta(JSON.stringify(m)).sound).toEqual({ music: true, sfx: false });
  });
});

describe('cues', () => {
  it('maps battle events to sounds', () => {
    const ids = battleCues([
      { type: 'hit', kind: 'ice', x: 0, y: 0, radius: 10 },
      { type: 'kill', x: 1080, y: 0, gold: 1, boss: false },
      { type: 'wave', wave: 5, boss: true },
      { type: 'end', won: true },
    ]).map((c) => c.id);
    expect(ids).toEqual(['hitIce', 'kill', 'boss', 'win']);
  });

  it('pans hits by where they land', () => {
    const [l, r] = battleCues([
      { type: 'hit', kind: 'fire', x: 0, y: 0, radius: 10 },
      { type: 'hit', kind: 'fire', x: 1080, y: 0, radius: 10 },
    ]);
    expect(l.pan).toBeLessThan(0);
    expect(r.pan).toBeGreaterThan(0);
  });
});

describe('synth', () => {
  it('every sound renders, finite and within its level', () => {
    for (const id of SFX_IDS) {
      const b = renderSfx(id, 22050);
      expect(b.length).toBe(Math.ceil(SFX[id].len * 22050));
      let peak = 0;
      for (const v of b) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  it('the loops last 30-60 s and their seam is smooth', () => {
    for (const id of TRACK_IDS) {
      expect(songLength(id)).toBeGreaterThanOrEqual(30);
      expect(songLength(id)).toBeLessThanOrEqual(60);
      const b = renderMusic(id, MUSIC_RATE);
      // the jump from the last sample back to the first is no bigger than a typical step
      let steps = 0;
      for (let i = 1; i < b.length; i++) steps += Math.abs(b[i] - b[i - 1]);
      const seam = Math.abs(b[0] - b[b.length - 1]);
      expect(seam).toBeLessThan((steps / b.length) * 6);
    }
  });
});
