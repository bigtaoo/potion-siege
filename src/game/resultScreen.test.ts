// The result screen's rewarded ads (resultScreen.ts), the revive and the ×2, and the midgame ad
// after them: the real game over a stand-in Pixi app and a host whose ads answer as each test
// scripts them. An ad can be watched, closed early, fail to load, or break.
import '../view/layout/measure';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { INTERSTITIAL_MINUTES } from '../platform/adPacing';
import { dayOf } from '../sim/daily';
import { doublesLeft } from '../sim/meta';
import { again } from './resultScreen';
import { buttons, englishPage, flush, play, playToEnd, tap, texts, veteran, world, type World } from './testWorld';

beforeAll(englishPage);

/** A full gap of battle play (platform/adPacing.ts): the test battles run in a blink. */
const PACED = INTERSTITIAL_MINUTES * 60_000;

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
    // the revive was on offer: no midgame ad in this break either
    expect(w.host.midgames).toBe(0);
  });

  it('plays no midgame ad after a loss whose revive was passed over', async () => {
    const w = world();
    play(w);
    playToEnd(w);
    expect(buttons(w.stage, t('revive'))).toHaveLength(1);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.game['menu'].visible).toBe(true);
    expect([w.host.rewardedCalls, w.host.midgames]).toEqual([0, 0]);
  });

  it('plays the midgame ad after a loss with no revive on offer', async () => {
    const w = world(veteran(), (h) => (h.available = false));
    w.game.pacing.played(PACED);
    play(w);
    playToEnd(w);
    expect(texts(w.stage)).not.toContain(t('adBlocked'));
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(1);
  });

  it('goes home unmuted when the midgame ad breaks', async () => {
    const w = world(veteran(), (h) => {
      h.available = false;
      h.midgameBreaks = true;
    });
    w.game.pacing.played(PACED);
    play(w);
    playToEnd(w);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(1);
    expect(w.game['menu'].visible).toBe(true);
    expect(w.game.audio.mix.ad).toBe(false);
  });

  it('holds the midgame ad back until a few minutes of battle play went by', async () => {
    const w = world(veteran(), (h) => (h.available = false));
    w.game.pacing.played(PACED - 1);
    play(w);
    playToEnd(w);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(0);
    expect(w.game['menu'].visible).toBe(true);
    expect(w.events('ad_paced')).toEqual([{ run: w.save().runs, secs: Math.round((PACED - 1) / 1000) }]);
    // the clock goes on across battles: the next break has the gap
    w.game.pacing.played(1);
    play(w);
    playToEnd(w);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(1);
    // and the ad on screen starts it over
    expect(w.game.pacing.due()).toBe(false);
  });

  it('counts a rewarded ad on screen as the last ad', async () => {
    const w = world();
    w.game.pacing.played(PACED);
    play(w);
    playToEnd(w);
    w.host.answers = ['closed'];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game.pacing.due()).toBe(false);
  });

  it('says an adblocker took the revive away instead of just leaving it out', () => {
    const w = world(veteran(), (h) => {
      h.available = false;
      h.blocked = true;
    });
    play(w);
    playToEnd(w);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
    expect(texts(w.stage)).toContain(t('adBlocked'));
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

  it('goes home to the tab of the tip tapped after a loss', async () => {
    const w = world();
    play(w);
    playToEnd(w);
    tap(w.stage, t('tip.workshop.name'));
    await flush();
    expect(w.game['menu'].visible).toBe(true);
    expect(w.game.tab).toBe('workshop');
    expect(w.events('result_action')).toEqual([expect.objectContaining({ action: 'tip', tab: 'workshop' })]);
  });

  it('asks the playtest question once on the web, a few battles in', async () => {
    vi.doMock('../view/feedback', async (orig) => ({
      ...(await orig<typeof import('../view/feedback')>()),
      FeedbackAsk: class {
        constructor(readonly send: unknown, readonly run: number) {}
      },
    }));
    vi.resetModules();
    try {
      const tw = await import('./testWorld');
      await tw.englishPage();
      const w = tw.world();
      Object.defineProperty(w.host, 'name', { value: 'web' });
      tw.play(w);
      tw.playToEnd(w);
      expect(w.game.ask).toMatchObject({ run: 9 });
      expect(w.events('feedback_shown')).toEqual([{ run: 9 }]);
    } finally {
      vi.doUnmock('../view/feedback');
      vi.resetModules();
    }
  });

  it('starts the next autoplay battle instead of going home', async () => {
    const w = world(veteran(), () => {}, 'speed=200&autoplay');
    w.game['battle']!.result = 'lost';
    const start = vi.spyOn(w.host, 'gameplayStart');
    await again(w.game);
    expect(w.game['menu'].visible).toBe(false);
    expect(w.game['battle']!.result).toBeNull();
    expect(start).toHaveBeenCalledOnce();
  });
});
