import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct, playOut } from './bot';
import { endlessSetup } from './endless';
import { newMeta } from './meta';
import { checkReplay, takeReplay } from './replay';
import { reactionPower } from './reactionPower';
import { mods } from './skills';
import { catalystCount, catalystFloor, catalyzed, CATALYSTS, isCatalyst, pickCatalyst, rollCatalysts } from './tower';
import { BALANCE, HERO_KINDS } from './types';

const K = BALANCE.endless.catalyst;

function towerSetup() {
  const m = newMeta();
  m.cleared = BALANCE.endless.unlock;
  m.stage = m.cleared + 1;
  for (const k of HERO_KINDS) m.heroes[k] = 30;
  return endlessSetup(m);
}

describe('the tower catalysts', () => {
  it('opens a pick on the floor after each boss, never on the first', () => {
    expect(catalystFloor(1)).toBe(false);
    expect([2, 5, 6, 10, 11, 16].map(catalystFloor)).toEqual([false, false, true, false, true, true]);
  });

  it('rolls three different catalysts, the same on the same seed and floor', () => {
    const a = rollCatalysts(7, 6);
    expect(new Set(a).size).toBe(3);
    expect(a.every(isCatalyst)).toBe(true);
    expect(rollCatalysts(7, 6)).toEqual(a);
    const seen = new Set<string>();
    for (let s = 1; s < 40; s++) for (const c of rollCatalysts(s, 11)) seen.add(c);
    expect(seen.size).toBe(CATALYSTS.length);
  });

  it('stacks its effects on the skills', () => {
    const base = mods({ ...new Battle(1).skills });
    const two = catalyzed(base, ['potent', 'potent', 'quick', 'bounty']);
    expect(two.damage('fire')).toBeCloseTo(base.damage('fire') * (1 + 2 * K.potent), 9);
    expect(catalystCount(Array(K.max + 3).fill('potent'), 'potent')).toBe(K.max);
    expect(two.speed).toBeCloseTo(base.speed * (1 + K.quick), 9);
    expect(two.goldPerKill).toBe(base.goldPerKill + K.bounty);
    expect(catalyzed(base, [])).toBe(base);
    expect(catalystCount(['wide', 'volatile', 'wide'], 'wide')).toBe(2);
  });

  it('pauses an endless battle at floor 6 until one is picked, and keeps it for the climb', () => {
    const b = new Battle(3, towerSetup());
    let guard = 0;
    while (!b.catalystChoices && !b.result && guard++ < 200_000) {
      botAct(b);
      b.step();
    }
    expect(b.result).toBeNull();
    expect(b.wave).toBe(6);
    expect(b.paused).toBe(true);
    const time = b.time;
    b.step();
    expect(b.time).toBe(time);
    const id = b.catalystChoices![0]!;
    expect(pickCatalyst(b, 'nope' as never)).toBe(false);
    expect(b.apply({ type: 'catalyst', id })).toBe(true);
    expect(b.catalysts).toEqual([id]);
    expect(b.catalystChoices).toBeNull();
    expect(b.paused).toBe(false);
  });

  it('raises reactions by the volatile and wide catalysts', () => {
    const b = new Battle(1, towerSetup());
    const plain = reactionPower(b, 'steam');
    b.catalysts.push('volatile', 'wide');
    const up = reactionPower(b, 'steam');
    expect(up.power).toBeCloseTo(plain.power * (1 + K.volatile), 9);
    expect(up.reach).toBeCloseTo(plain.reach * (1 + K.wide), 9);
  });

  it('repairs and widens the wall with the mortar', () => {
    const b = new Battle(1, towerSetup());
    b.wall = 1;
    b.catalystChoices = ['bulwark', 'quick', 'potent'];
    const max = b.wallMax;
    expect(pickCatalyst(b, 'bulwark')).toBe(true);
    expect(b.wallMax).toBe(Math.round(max * (1 + K.bulwark)));
    expect(b.wall).toBe(b.wallMax);
  });

  it('plays a bot climb back from its replay, picks and all', () => {
    const b = playOut(5, 900, towerSetup());
    expect(b.catalysts.length).toBeGreaterThan(0);
    expect(checkReplay(takeReplay(b))).toBe(true);
  });

  it('never offers one in a campaign battle', () => {
    const b = playOut(5, 600);
    expect(b.catalysts).toEqual([]);
  });
});
