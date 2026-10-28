// The result board's rows drawn on their own (endRows.ts): the crests, the endless and challenge
// tracks, the crystals with and without the ×2, the tips and the buttons, read back by their
// English words, their fills and what their taps call.
import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { buttons, englishPage, tap, texts } from '../../game/testWorld';
import { CHALLENGE_TIERS } from '../../sim/challenge';
import { DOUBLES_PER_DAY } from '../../sim/meta';
import { LIGHT, P, PillButton, STAR_HARD } from '../kit';
import { fillColors } from '../kit/kitTestBits';
import { COLORS } from '../ui';
import type { ChallengeEnd, EndExtras, EndlessEnd, TipTab } from './endTypes';
import { challengeTrack, damageChart, endButtons, endlessHeader, endlessTrack, header, purse, ribbon, statTiles, tips } from './endRows';

beforeAll(englishPage);

const graphics = (root: Container): Graphics[] => {
  const out: Graphics[] = [];
  const walk = (c: Container) => {
    if (c instanceof Graphics) out.push(c);
    c.children.forEach(walk);
  };
  walk(root);
  return out;
};
const fills = (root: Container) => graphics(root).flatMap(fillColors);
const count = (xs: number[], x: number) => xs.filter((y) => y === x).length;

function challenge(wave: number, tier: number): ChallengeEnd {
  return { result: { wave, best: wave, tier, bestTier: tier, crystals: 0 }, mods: ['swift', 'trial'], trial: 'fire', streak: 1, streakBonus: 0 };
}

const endless = (wave: number, best: number, record: boolean, next: EndlessEnd['next']): EndlessEnd => ({
  result: { wave, before: best, record, milestones: 0 },
  best,
  next,
});

const extras = (more: Partial<EndExtras>): EndExtras => ({ onDouble: null, doubled: false, dealt: [], onTip: null, ...more });

describe('the crest', () => {
  it('lights a star per tier a challenge reached, under the challenge plate', () => {
    const s = header(false, challenge(20, 2));
    expect(texts(s.c)).toEqual([t('challenge.result')]);
    expect(count(fills(s.c), COLORS.gold)).toBe(2);
  });

  it('knocks the wall apart over a challenge that reached no tier', () => {
    const s = header(true, challenge(3, 0));
    expect(count(fills(s.c), COLORS.gold)).toBe(0);
  });

  it('knocks the wall apart under the lost plate', () => {
    const s = header(false);
    expect(texts(s.c)).toEqual([t('lost')]);
    expect(count(fills(s.c), COLORS.gold)).toBe(0);
  });

  it('lights a win\'s stars red on hard mode', () => {
    const s = header(true, undefined, 1, true);
    expect(texts(s.c)).toEqual([t('won')]);
    expect(count(fills(s.c), STAR_HARD)).toBe(1);
  });

  it('puts stars round the endless loop only on a new record', () => {
    expect(count(fills(endlessHeader(endless(30, 30, true, null)).c), COLORS.gold)).toBe(3);
    const plain = endlessHeader(endless(12, 30, false, null));
    expect(texts(plain.c)).toEqual([t('endless.result')]);
    expect(count(fills(plain.c), COLORS.gold)).toBe(0);
  });
});

describe('the endless track', () => {
  it('fills toward the next milestone and names it', () => {
    const s = endlessTrack(endless(17, 17, true, { wave: 20, reward: 100 }), 900);
    expect(texts(s.c)).toContain(`${t('endless.next', { n: 20 })}   ${t('reward', { n: 100 })}`);
    expect(count(fills(s.c), P.green)).toBe(1);
  });

  it('leaves the bar empty while the best is short of the first milestone', () => {
    const s = endlessTrack(endless(2, 0, false, { wave: 10, reward: 50 }), 900);
    expect(texts(s.c)).toContain(t('endless.reached', { n: 2 }));
    expect(count(fills(s.c), P.green)).toBe(0);
  });

  it('fills the bar and says all done once every milestone is had', () => {
    const s = endlessTrack(endless(99, 99, false, null), 900);
    expect(texts(s.c)).toContain(t('endless.allDone'));
    expect(count(fills(s.c), P.green)).toBe(1);
  });
});

describe('the challenge track', () => {
  it('leaves the track empty and every medal unlit at wave 0', () => {
    const s = challengeTrack(challenge(0, 0), 1000);
    expect(texts(s.c)).toContain(t('challenge.reached', { n: 0 }));
    const f = fills(s.c);
    expect(count(f, P.green)).toBe(0);
    expect(count(f, COLORS.gold)).toBe(0);
    expect(count(f, LIGHT.inset)).toBeGreaterThanOrEqual(CHALLENGE_TIERS.length);
  });

  it('fills up to the wave reached and lights the tiers got', () => {
    const s = challengeTrack(challenge(CHALLENGE_TIERS[1].wave, 2), 1000);
    expect(count(fills(s.c), P.green)).toBe(1);
    expect(count(fills(s.c), COLORS.gold)).toBe(2);
  });
});

describe('the purse', () => {
  const reward = { crystals: 40, firstClear: false, unlocked: [] };

  it('offers the ×2 full height when the day\'s count is not shown', () => {
    let doubled = 0;
    const s = purse(reward, extras({ onDouble: () => doubled++ }), 1000);
    expect(texts(s.c)).not.toContain(t('doublesLeft', { n: 0, total: DOUBLES_PER_DAY }));
    tap(s.c, t('double'));
    expect(doubled).toBe(1);
  });

  it('shows the ×2 greyed out, doing nothing, once today\'s are used up', () => {
    const s = purse(reward, extras({ onDouble: null, doublesLeft: 0 }), 1000);
    expect(texts(s.c)).toContain(t('doublesLeft', { n: 0, total: DOUBLES_PER_DAY }));
    const [b] = buttons(s.c, t('double')) as PillButton[];
    expect(b['enabled']).toBe(false);
    // even switched on, the stand-in tap does nothing
    b.setEnabled(true).emit('pointertap', { stopPropagation() {} } as never);
  });

  it('shrinks the words, not below 0.8, to keep a big count beside the ×2 on a narrow purse', () => {
    const s = purse({ ...reward, crystals: 99999 }, extras({ onDouble: () => {} }), 760);
    const what = s.c.children[0].children.find((c) => texts(c).join() === t('earned'))!;
    expect(what.scale.x).toBeLessThan(1);
    expect(what.scale.x).toBeGreaterThanOrEqual(0.8);
  });

  it('shows the count on the right and the brass seal once doubled', () => {
    const s = purse(reward, extras({ doubled: true }), 1000);
    expect(texts(s.c)).toContain(t('doubled'));
    expect(buttons(s.c, t('double'))).toEqual([]);
  });

  it('shows the count alone with neither ×2 nor seal', () => {
    const s = purse(reward, extras({}), 1000);
    expect(texts(s.c)).toEqual([t('earned'), t('reward', { n: 40 })]);
  });
});

describe('the tips and the buttons', () => {
  it('open their tab, the ready one lit', () => {
    const asked: TipTab[] = [];
    const s = tips((tab) => asked.push(tab), [], 900, ['battle', 'potions'], 'battle');
    expect(texts(s.c)).toContain(t('tip.now'));
    tap(s.c, t('tip.stage.name'));
    tap(s.c, t('tip.potions.name'));
    expect(asked).toEqual(['battle', 'potions']);
  });

  it('say the adblocker took the revive away, over a big Continue', () => {
    let went = 0;
    const s = endButtons(() => went++, null, null, true);
    expect(texts(s.c).join(' ').replace(/\n/g, ' ')).toBe(`${t('adBlocked').replace(/\n/g, ' ')} ${t('continue')}`);
    tap(s.c, t('continue'));
    expect(went).toBe(1);
  });

  it('put the revive over a smaller Continue', () => {
    const calls: string[] = [];
    const s = endButtons(() => calls.push('go'), () => calls.push('revive'), null, true);
    expect(texts(s.c)).not.toContain(t('adBlocked'));
    tap(s.c, t('revive'));
    tap(s.c, t('continue'));
    expect(calls).toEqual(['revive', 'go']);
  });
});

describe('the stats, the damage and the ribbon', () => {
  it('give wave, kills and time a tile each, a long part shrunk to its tile', () => {
    const long = 'a very long stat line indeed';
    const s = statTiles(`Wave 5  Kills 30  ${long}  extra`, 600);
    expect(texts(s.c)).toEqual(['Wave 5', 'Kills 30', long]);
    const tile = s.c.children[2];
    expect(tile.children[tile.children.length - 1].scale.x).toBeLessThan(1);
  });

  it('chart the damage biggest first, the MVP tagged, with shares that add up', () => {
    const s = damageChart(
      [
        { kind: 'ice', damage: 25 },
        { kind: 'fire', damage: 75 },
      ],
      900,
    );
    expect(texts(s.c)).toEqual([t('damage'), '75%', t('mvp'), '25%']);
  });

  it('lead the tips with the biggest dealer, all three by default', () => {
    const asked: TipTab[] = [];
    const s = tips(
      (tab) => asked.push(tab),
      [
        { kind: 'fire', damage: 1 },
        { kind: 'ice', damage: 3 },
      ],
      600,
    );
    expect(texts(s.c)).not.toContain(t('tip.now'));
    tap(s.c, t('tip.workshop.name'));
    expect(asked).toEqual(['workshop']);
  });

  it('put Next Stage over a smaller back', () => {
    const calls: string[] = [];
    const s = endButtons(() => calls.push('back'), null, () => calls.push('next'));
    tap(s.c, t('nextStage'));
    tap(s.c, t('back'));
    expect(calls).toEqual(['next', 'back']);
  });

  it('shrink the words on a narrow ribbon', () => {
    const short = ribbon('Hi', 600);
    const long = ribbon('A very long note on a narrow ribbon', 200);
    expect(short.children[1].scale.x).toBe(1);
    expect(long.children[1].scale.x).toBeLessThan(1);
  });
});
