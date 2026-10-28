import '../layout/measure';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Text } from 'pixi.js';
import { t } from '../../i18n';
import { englishPage, tap, texts } from '../../game/testWorld';
import { CHALLENGE_TIERS, todaysChallenge } from '../../sim/challenge';
import { newMeta, type MetaSave } from '../../sim/meta';
import { fillColors } from '../kit/kitTestBits';
import { challengePanel } from './challengePanel';
import { loggedActions, PHONE } from './homeTestBits';

const TODAY = '2026-10-28';

beforeAll(englishPage);
afterEach(() => vi.useRealTimers());

/** A save that played today `attempts` times, its best `best`, `streak` days in a row. */
function played(attempts: number, best = 0, streak = 1): MetaSave {
  const m = newMeta();
  m.challenge = { date: TODAY, attempts, best, streak, bestStreak: streak };
  return m;
}

/** The reward tiles drawn as reached. */
function reached(root: Container): number {
  let n = 0;
  const walk = (c: Container): void => {
    if (c instanceof Graphics && fillColors(c)[0] === 0xd4eec0) n++;
    c.children.forEach(walk);
  };
  walk(root);
  return n;
}

describe('challenge panel', () => {
  it('lists the day\'s modifiers, the tiers and the stage in its title', () => {
    const m = newMeta();
    const { act } = loggedActions();
    const ch = todaysChallenge(m, TODAY);
    const words = texts(challengePanel(m, act, TODAY, true, PHONE));
    expect(words).toContain(`${t('challenge.title')} · ${t('stage', { n: ch.stage })}`);
    for (const id of ch.mods) expect(words).toContain(t(`challenge.mod.${id}.name`));
    for (const tier of CHALLENGE_TIERS) {
      expect(words).toContain(t('challenge.wave', { n: tier.wave }));
      expect(words).toContain(String(tier.reward));
    }
  });

  it('offers the free attempt first, nothing reached and no streak yet', () => {
    const m = newMeta();
    const { act, calls } = loggedActions();
    const p = challengePanel(m, act, TODAY, true, PHONE);
    expect(reached(p)).toBe(0);
    expect(texts(p)).toContain(t('challenge.best', { n: 0 }));
    tap(p, t('challenge.go'));
    expect(calls).toEqual([['challenge', []]]);
  });

  it('ticks the tiers reached today and tells the streak', () => {
    const best = CHALLENGE_TIERS[1].wave;
    const p = challengePanel(played(1, best, 3), loggedActions().act, TODAY, true, PHONE);
    expect(reached(p)).toBe(2);
    expect(texts(p)).toContain(`${t('challenge.best', { n: best })}   ·   ${t('challenge.streak', { n: 3 })}`);
    expect(texts(p)).toContain('✓');
  });

  it('offers the rewarded retry once the free attempt is used', () => {
    const { act, calls } = loggedActions();
    const p = challengePanel(played(1), act, TODAY, true, PHONE);
    expect(texts(p)).not.toContain(t('challenge.go'));
    tap(p, t('challenge.retry'));
    expect(calls).toEqual([['challengeAd', []]]);
  });

  it('counts down to the next one when there is nothing left to play', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 22, 58, 30));
    for (const [m, ads] of [[played(1), false], [played(2), true]] as const) {
      const p = challengePanel(m, loggedActions().act, TODAY, ads, PHONE);
      expect(texts(p)).not.toContain(t('challenge.retry'));
      const left = texts(p).indexOf('');
      expect(left).toBeGreaterThanOrEqual(0);
      const find = (c: Container): Text | undefined => (c instanceof Text && c.onRender ? c : c.children.map(find).find(Boolean));
      const clock = find(p)!;
      clock.onRender!(null as never);
      expect(clock.text).toBe(t('challenge.next', { time: '01:01:30' }));
      vi.setSystemTime(new Date(2026, 9, 28, 23, 59, 59));
      clock.onRender!(null as never);
      expect(clock.text).toBe(t('challenge.next', { time: '00:00:01' }));
      vi.setSystemTime(new Date(2026, 9, 28, 22, 58, 30));
    }
  });
});
