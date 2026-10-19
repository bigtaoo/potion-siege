// The result screen's rewarded ads (resultScreen.ts), the revive and the ×2, and the midgame ad
// after them: the real game over a stand-in Pixi app and a host whose ads answer as each test
// scripts them. An ad can be watched, closed early, fail to load, or break.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { dayOf } from '../sim/daily';
import { doublesLeft } from '../sim/meta';
import { buttons, englishPage, flush, play, playToEnd, tap, veteran, world, type World } from './testWorld';

beforeAll(englishPage);

describe('the result screen', () => {
  it('revives the battle when the ad was watched', async () => {
    const w = world();
    play(w);
    playToEnd(w);
    w.host.answers = ['watched'];
    tap(w.stage, t('revive'));
    await flush();
    const b = w.game['battle']!;
    expect(b.result).toBeNull();
    expect(w.game['ended']).toBe(false);
    expect(w.game['overlay'].visible).toBe(false);
    // a revived battle that is lost again offers no second revive
    playToEnd(w);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
  });

  it.each(['closed', 'failed', 'broke'] as const)('brings the result back without the revive when the ad was %s', async (answer) => {
    const w = world();
    play(w);
    playToEnd(w);
    const runs = w.save().runs;
    w.host.answers = [answer];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game['battle']!.result).toBe('lost');
    expect(w.game['overlay'].visible).toBe(true);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
    expect(w.save().runs, 'still one run').toBe(runs);
  });

  /** A lost battle whose revive was turned down: the ×2 is offered in its place. */
  async function doubleOffered(): Promise<World> {
    const w = world();
    play(w);
    playToEnd(w);
    w.host.answers = ['closed'];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game['purse'].paid).toBeGreaterThan(0);
    return w;
  }

  it('pays the battle once more for a watched ×2, once', async () => {
    const w = await doubleOffered();
    const before = w.save().crystals;
    const paid = w.game['purse'].paid;
    const left = doublesLeft(w.save());
    w.host.answers = ['watched'];
    tap(w.stage, t('double'));
    await flush();
    expect(w.save().crystals).toBe(before + paid);
    expect(doublesLeft(w.save())).toBe(left - 1);
    expect(buttons(w.stage, t('double'))).toHaveLength(0);
    // no midgame ad chained after a rewarded one in the same break
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(0);
  });

  it.each(['closed', 'failed', 'broke'] as const)('pays nothing for a ×2 that was %s, and the screen still answers', async (answer) => {
    const w = await doubleOffered();
    const before = w.save().crystals;
    w.host.answers = [answer];
    tap(w.stage, t('double'));
    await flush();
    expect(w.save().crystals).toBe(before);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
    expect(w.game['overlay'].visible).toBe(true);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.game['menu'].visible).toBe(true);
    // a break after a battle with no ad watched gets the portal's midgame ad
    expect(w.host.midgames).toBe(1);
  });

  it('plays no ×2 ad once the day is used up', async () => {
    const m = veteran();
    m.daily.day = dayOf(new Date());
    m.daily.doubles = 99;
    const w = world(m);
    play(w);
    playToEnd(w);
    w.host.answers = ['closed'];
    tap(w.stage, t('revive'));
    await flush();
    const crystals = w.save().crystals;
    // the button stays, greyed out, over its "none left today" note
    tap(w.stage, t('double'));
    await flush();
    expect(w.host.rewardedCalls).toBe(1);
    expect(w.save().crystals).toBe(crystals);
  });
});
