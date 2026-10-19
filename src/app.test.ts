// The card reroll as the player meets it: the real game over a stand-in Pixi app
// (game/testWorld.ts) and a host whose ads answer as each test scripts them. The other ads and
// the ad-free card are tested beside the flows that offer them, in src/game/.
import './view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from './i18n';
import { buttons, englishPage, flush, play, tap, world, type World } from './game/testWorld';

beforeAll(englishPage);

describe('the card reroll', () => {
  /** Buys a skill offer with gold handed over (an idle battle loses before it earns one), so
   *  the cards come up with their reroll. */
  function offer(w: World): void {
    const g = w.game;
    g['battle']!.gold = 1000;
    expect(g['battle']!.upgrade()).toBe(true);
    g['tick'](0.001);
    expect(buttons(w.stage, t('reroll'))).toHaveLength(1);
  }

  it('deals new cards when the ad was watched', async () => {
    const w = world();
    play(w);
    offer(w);
    const b = w.game['battle']!;
    const before = [...b.choices!];
    w.host.answers = ['watched'];
    tap(w.stage, t('reroll'));
    await flush();
    expect(b.choices).not.toEqual(before);
    expect(w.game['overlay'].visible).toBe(true);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
  });

  it.each(['closed', 'failed', 'broke'] as const)('keeps the cards and takes the reroll away when the ad was %s', async (answer) => {
    const w = world();
    play(w);
    offer(w);
    const b = w.game['battle']!;
    const before = [...b.choices!];
    w.host.answers = [answer];
    tap(w.stage, t('reroll'));
    await flush();
    expect(b.choices).toEqual(before);
    expect(w.game['overlay'].visible).toBe(true);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
    expect(buttons(w.stage, t('reroll'))).toHaveLength(0);
  });
});
