import { Sprite, Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import type { Enemy } from '../../sim/types';
import { BASH_EVERY } from '../enemyGait';
import { EnemyTracks, HIT_TIME, PUSH_TIME, keep } from './enemyTracks';

function foe(o: Partial<Enemy> = {}): Enemy {
  return { id: 1, kind: 'grunt', x: 500, y: 800, radius: 40, hp: 100, maxHp: 100, ...o } as Enemy;
}

/** A frame at `now` seeing `foes`, after `before` (strikes, deaths...). */
function frame(t: EnemyTracks, now: number, foes: Enemy[], before = () => {}) {
  before();
  t.begin(now);
  return foes.map((e) => {
    const track = t.see(e, false);
    track.snap.tex = Texture.WHITE;
    return track;
  });
}

describe('EnemyTracks', () => {
  it('lights up one that lost HP where a blow landed, for a moment', () => {
    const t = new EnemyTracks();
    frame(t, 0, [foe()]);
    t.end(() => {});
    t.strike(510, 800, 20);
    const [hit] = frame(t, 0.02, [foe({ hp: 80 })]);
    expect(t.reaction(hit, 0).hit).toBe(1);
    t.end(() => {});
    const [later] = frame(t, 0.02 + HIT_TIME / 2, [foe({ hp: 80 })]);
    expect(t.reaction(later, 0).hit).toBeCloseTo(0.5);
    expect(t.reaction(later, 0.3).spin).toBe(0.3);
  });

  it('does not light up one burning down, or one hurt out of a blow\'s reach', () => {
    const t = new EnemyTracks();
    frame(t, 0, [foe(), foe({ id: 2, x: 900 })]);
    t.end(() => {});
    t.strike(500, 800, 10);
    const [a, b] = frame(t, 0.03, [foe(), foe({ id: 2, x: 900, hp: 70 })]);
    expect(t.reaction(a, 0).hit).toBe(0);
    expect(t.reaction(b, 0).hit).toBe(0);
  });

  it('drains the white trail of the HP lost after a wait, down to what is left', () => {
    const t = new EnemyTracks();
    frame(t, 0, [foe()]);
    t.end(() => {});
    let [tr] = frame(t, 0.1, [foe({ hp: 40 })], () => t.strike(500, 800, 10));
    expect(tr.trail).toBe(100);
    t.end(() => {});
    [tr] = frame(t, 0.3, [foe({ hp: 40 })]);
    expect(tr.trail).toBe(100);
    t.end(() => {});
    [tr] = frame(t, 0.4, [foe({ hp: 40 })]);
    expect(tr.trail).toBeCloseTo(100 - 150 * 0.1);
    for (let i = 1; i < 20; i++) [tr] = frame(t, 0.4 + i * 0.1, [foe({ hp: 40 })]);
    expect(tr.trail).toBe(40);
    [tr] = frame(t, 3, [foe({ hp: 90 })]);
    expect(tr.trail).toBe(90);
  });

  it('throws one back for a moment once the wind pushes it', () => {
    const t = new EnemyTracks();
    frame(t, 0, [foe()]);
    t.pushed(1);
    t.pushed(99);
    const [tr] = frame(t, PUSH_TIME / 2, [foe()]);
    expect(t.reaction(tr, 0).push).toBeCloseTo(0.5);
  });

  it('brings a blow down on the wall each time its swing passes the impact', () => {
    const t = new EnemyTracks();
    const e = foe({ id: 0 });
    const [tr] = frame(t, 0, [e]);
    const every = BASH_EVERY.grunt;
    expect(t.blow(tr, e, 0.5 * every, true)).toBe(false);
    expect(t.blow(tr, e, 0.75 * every, true)).toBe(true);
    expect(t.blow(tr, e, 0.8 * every, true)).toBe(false);
    // past the impact and round again in one frame
    expect(t.blow(tr, e, 1.6 * every, true)).toBe(false);
    expect(t.blow(tr, e, 2.1 * every, true)).toBe(true);
    expect(t.blow(tr, e, 2.6 * every, false)).toBe(false);
    expect(t.blow(tr, e, 2.75 * every, true)).toBe(false);
  });

  it('wrecks one gone that died near where it was last drawn, and forgets the rest', () => {
    const t = new EnemyTracks();
    frame(t, 0, [foe(), foe({ id: 2, x: 100 }), foe({ id: 3, x: 900 })]);
    t.end(() => {});
    const wreck = vi.fn();
    frame(t, 0.03, [], () => t.died(520, 790));
    t.end(wreck);
    expect(wreck).toHaveBeenCalledTimes(1);
    expect(wreck.mock.calls[0][0].tex).toBe(Texture.WHITE);
    frame(t, 0.06, [foe({ id: 2, x: 100 })], () => t.died(100, 800));
    t.end(wreck);
    expect(wreck).toHaveBeenCalledTimes(1);
    t.clear();
    frame(t, 0.09, []);
    t.end(wreck);
    expect(wreck).toHaveBeenCalledTimes(1);
  });

  it('keeps where a sprite stands', () => {
    const s = new Sprite(Texture.WHITE);
    s.position.set(3, 4);
    s.scale.set(2, 0.5);
    s.rotation = 0.3;
    s.tint = 0xff0000;
    const into = { tex: Texture.EMPTY, x: 0, y: 0, sx: 1, sy: 1, rot: 0, tint: 0 };
    keep(s, into);
    expect(into).toEqual({ tex: Texture.WHITE, x: 3, y: 4, sx: 2, sy: 0.5, rot: 0.3, tint: 0xff0000 });
  });
});
