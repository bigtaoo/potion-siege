// The one-time words in the first battles (battleTips.ts) in the real game: battle 2's line on the
// first affordable 强化, battle 3's line under the first skill pick, stage 1's boss card and the
// first won result's line on stars, each once a save.
import '../view/layout/measure';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { botAct } from '../sim/bot';
import { newMeta, type MetaSave } from '../sim/meta';
import { englishPage, play, texts, veteran, world, type World } from './testWorld';

beforeAll(englishPage);
// the pick's hand listens on the window for the player's touches
beforeEach(() => vi.stubGlobal('window', new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

/** A new player who has played `runs` battles, the home guide of the chapter behind them. */
function after(runs: number): MetaSave {
  const m = newMeta();
  m.runs = runs;
  m.tutorial = true;
  m.cleared = runs;
  m.stage = runs + 1;
  m.guide = ['gift', 'upgrade', 'upgradeMore', 'upgradeLast', 'toBattle1', 'login', 'tasks', 'workshop', 'toBattle2'];
  return m;
}

/** Plays the battle out with the bot's hands (autoplay itself gets no words). */
function botToEnd(w: World): void {
  const g = w.game;
  for (let i = 0; i < 20_000 && !g['ended']; i++) {
    const b = g['battle']!;
    if (b.choices) g['pick'](b.choices[0]);
    else botAct(b);
    g['tick'](0.005);
  }
  expect(g['ended'], 'the battle ended').toBe(true);
}

const marked = (w: World) => w.events('guide_step').map((e) => e.id);

describe('the one-time words in battle', () => {
  it("says what 强化 brings the first time battle 2 can pay for it, and drops it at the cards", () => {
    const w = world(after(1));
    play(w);
    const g = w.game;
    const b = g['battle']!;
    // the test's speed runs a battle out in a few frames: the gold goes in before the first
    b.gold = 10_000;
    g['tick'](0.01);
    expect(g.hud.noted).toBe(t('guide.upgrade2'));
    expect(marked(w)).toEqual(['upgrade2']);
    b.upgrade();
    g['tick'](0.01);
    expect(g.hud.noted).toBe('');
    g['pick'](b.choices![0]);
    b.gold = 10_000;
    g['tick'](0.01);
    expect(marked(w)).toEqual(['upgrade2']);
  });

  it("puts a line under battle 3's first skill pick only", () => {
    const w = world(after(2));
    play(w);
    const g = w.game;
    const b = g['battle']!;
    const tip = t('guide.pickTip');
    g['tick'](0.001);
    b.gold = 10_000;
    b.upgrade();
    g['tick'](0.01);
    expect(texts(g['overlay'])).toContain(tip);
    g['pick'](b.choices![0]);
    b.gold = 10_000;
    b.upgrade();
    g['tick'](0.01);
    expect(g['overlay'].visible).toBe(true);
    expect(texts(g['overlay'])).not.toContain(tip);
    expect(marked(w)).toEqual(['pickTip']);
  });

  it("shows stage 1's boss its card and the first win's stars their line, once each", () => {
    const m = veteran();
    m.stage = 1;
    m.guide = [];
    const w = world(m);
    play(w);
    botToEnd(w);
    expect(marked(w)).toEqual(expect.arrayContaining(['bossCard', 'stars']));
    expect(texts(w.game['overlay'])).toContain(t('guide.stars'));
    const again = veteran();
    again.stage = 1;
    again.guide = ['bossCard', 'stars'];
    const w2 = world(again);
    play(w2);
    botToEnd(w2);
    expect(marked(w2)).toEqual([]);
    expect(texts(w2.game['overlay'])).not.toContain(t('guide.stars'));
  });
});
