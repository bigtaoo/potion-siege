import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BattleEvent } from '../sim/types';
import { Haptics } from './haptics';
import { englishPage, veteran, world } from './testWorld';

beforeAll(englishPage);

/** Haptics over a device that buzzes into `buzzes` (true: strong), switched by `on`. */
function device(on = () => true) {
  const buzzes: boolean[] = [];
  return { h: new Haptics((strong) => buzzes.push(strong), on), buzzes };
}

const kill = (boss: boolean): BattleEvent => ({ type: 'kill', kind: 'grunt', x: 0, y: 0, gold: 1, boss }) as BattleEvent;

describe('haptics', () => {
  it.each<[string, BattleEvent]>([
    ['a boss wave', { type: 'wave', wave: 5, boss: true }],
    ["a boss's slam", { type: 'slam', x: 0, y: 0, slots: [] }],
    ["a boss's kill", kill(true)],
    ['the wall falling', { type: 'end', won: false }],
  ])('buzzes strong for %s', (_, e) => {
    const { h, buzzes } = device();
    h.react([e, { type: 'merge', slot: 0, star: 2, kind: 'fire' }]);
    expect(buzzes).toEqual([true]);
  });

  it('buzzes short for a merge', () => {
    const { h, buzzes } = device();
    h.react([{ type: 'merge', slot: 0, star: 2, kind: 'fire' }]);
    expect(buzzes).toEqual([false]);
  });

  it('leaves the rest of the battle quiet', () => {
    const { h, buzzes } = device();
    h.react([]);
    h.react([{ type: 'wave', wave: 2, boss: false }, kill(false), { type: 'end', won: true }, { type: 'summon', slot: 3 }]);
    expect(buzzes).toEqual([]);
  });

  it('buzzes for the wall at most once in 600 ms, however often it is hit', () => {
    const { h, buzzes } = device();
    const hit: BattleEvent[] = [{ type: 'wallHit' }];
    h.react(hit, 1000);
    h.react(hit, 1300);
    h.react(hit, 1599);
    expect(buzzes).toEqual([false]);
    h.react(hit, 1600);
    expect(buzzes).toEqual([false, false]);
    // a merge in the gap still buzzes
    h.react([...hit, { type: 'merge', slot: 0, star: 2, kind: 'fire' }], 1700);
    expect(buzzes).toEqual([false, false, false]);
  });

  it('is silent with the setting off, and turns back on with it', () => {
    let on = false;
    const { h, buzzes } = device(() => on);
    h.react([{ type: 'end', won: false }]);
    h.react([{ type: 'wallHit' }], 0);
    expect(buzzes).toEqual([]);
    on = true;
    h.react([{ type: 'wallHit' }], 0);
    expect(buzzes).toEqual([false]);
  });

  it('does nothing on a device that cannot vibrate', () => {
    expect(() => new Haptics(undefined, () => true).react([{ type: 'end', won: false }])).not.toThrow();
  });

  it("follows the save's setting in the game, over the host's vibrate", () => {
    const buzzes: boolean[] = [];
    const m = veteran();
    m.sound.haptics = false;
    const w = world(m, (h) => Object.assign(h, { vibrate: (strong: boolean) => buzzes.push(strong) }));
    w.game['haptics'].react([{ type: 'end', won: false }]);
    expect(buzzes).toEqual([]);
    w.game.save.sound.haptics = true;
    w.game['haptics'].react([{ type: 'end', won: false }]);
    expect(buzzes).toEqual([true]);
  });
});
