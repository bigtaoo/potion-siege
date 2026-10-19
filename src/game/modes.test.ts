// Today's challenge's second go (modes.ts), bought with a rewarded ad that can be watched,
// closed early or break: the real game over a stand-in Pixi app.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { dayOf } from '../sim/daily';
import { home } from './homeScreen';
import { englishPage, flush, tap, veteran, world } from './testWorld';

beforeAll(englishPage);

describe("the challenge's second go", () => {
  const used = () => {
    const m = veteran();
    const today = dayOf(new Date());
    m.challenge.date = today;
    m.challenge.attempts = 1;
    return m;
  };

  it('starts the retry when the ad was watched', async () => {
    const w = world(used());
    home(w.game, 'challenge');
    w.host.answers = ['watched'];
    tap(w.stage, t('challenge.retry'));
    await flush();
    expect(w.game['challenge']).not.toBeNull();
    expect(w.game['menu'].visible).toBe(false);
    expect(w.save().challenge.attempts).toBe(2);
  });

  it.each(['closed', 'broke'] as const)('stays home with the retry still on offer when the ad was %s', async (answer) => {
    const w = world(used());
    home(w.game, 'challenge');
    w.host.answers = [answer];
    tap(w.stage, t('challenge.retry'));
    await flush();
    expect(w.game['challenge']).toBeNull();
    expect(w.game['menu'].visible).toBe(true);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.save().challenge.attempts).toBe(1);
  });
});
