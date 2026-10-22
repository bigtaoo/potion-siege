// What each mode books into the save, on every save from brand-new to maxed: the bot plays a
// story stage (revived once when it falls, then the ×2), the daily challenge to its last
// attempt, and an endless run (revived too). Afterwards no number in the save is NaN, infinite
// or negative, crystals only ever went up, and the save reads back as it was stored.
import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { beginAttempt, bookAttempt, challengeSetup } from './challenge';
import { beginEndless, bookEndless, endlessOpen, endlessPay, endlessSetup } from './endless';
import { battleSetup, parseMeta, Purse, type BattleSetup, type MetaSave } from './meta';
import { challengeFor, SAVES, type SaveId } from './setupCatalog';
import { bookStars, runStars } from './stars';

const TODAY = '2026-10-22';
const CAP = 1200 * 30;

/** Plays the bot to the battle's end (or the cap); `b` may be one revived. */
function botPlay(b: Battle): Battle {
  for (let t = 0; t < CAP && b.result === null; t++) {
    botAct(b);
    b.step();
    b.drain();
  }
  return b;
}

/** Paths in the save to a number that is not finite and at 0 or above. */
function badNumbers(v: unknown, path = 'save'): string[] {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? [] : [`${path} = ${v}`];
  if (v === null || typeof v !== 'object') return [];
  return Object.entries(v).flatMap(([k, x]) => badNumbers(x, `${path}.${k}`));
}

/** The save after a JSON round trip, as the game stores it. */
const stored = (m: MetaSave) => parseMeta(JSON.stringify(m));

function sane(m: MetaSave, before: number): void {
  expect(badNumbers(m)).toEqual([]);
  expect(m.crystals).toBeGreaterThanOrEqual(before);
  expect(stored(m)).toEqual(m);
}

const result = (b: Battle, s: BattleSetup) => ({ stage: s.stage, won: b.result === 'won', wave: b.wave, kills: b.kills });

describe.each(Object.keys(SAVES) as SaveId[])('on the %s save', (id) => {
  it('a story stage, revived and doubled, pays once for what it earned', () => {
    const m = SAVES[id]();
    const start = m.crystals;
    const s = battleSetup(m);
    const b = botPlay(new Battle(1, s));
    const purse = new Purse();
    const first = purse.settle(m, result(b, s)).crystals;
    const after = m.crystals;
    let revived = false;
    if (b.result === 'lost' && b.revive()) {
      revived = true;
      botPlay(b);
      purse.settle(m, result(b, s));
    }
    // the game books a win's stars beside the crystals (src/game/ending.ts)
    if (b.result === 'won') bookStars(m, s.stage, false, runStars(true, revived, Math.max(0, b.wall) / b.wallMax));
    // the revived battle pays only what it earned on top
    expect(m.crystals - start).toBe(purse.paid);
    expect(purse.paid).toBeGreaterThanOrEqual(first);
    expect(after).toBe(start + first);
    const doubled = purse.double(m, true);
    expect(doubled === 0 || doubled === purse.paid).toBe(true);
    expect(purse.double(m, true), 'one ×2 a battle').toBe(0);
    sane(m, start);
  });

  it("today's challenge, its free attempt and its ad one, then none", () => {
    const m = SAVES[id]();
    const start = m.crystals;
    for (const [i, ad] of [false, true].entries()) {
      expect(beginAttempt(m, TODAY, ad), `attempt ${i + 1}`).not.toBeNull();
      const s = challengeSetup(m, challengeFor(m, i ? ['swift'] : [], i + 1));
      const b = botPlay(new Battle(i + 1, s));
      const r = bookAttempt(m, b.wave);
      expect(r.crystals).toBeGreaterThanOrEqual(0);
      expect(m.challenge.best).toBe(r.best);
    }
    expect(beginAttempt(m, TODAY, false)).toBeNull();
    expect(beginAttempt(m, TODAY, true)).toBeNull();
    expect(m.challenge.attempts).toBe(2);
    sane(m, start);
  });

  it('an endless run, revived once, books its waves once', () => {
    const m = SAVES[id]();
    if (!endlessOpen(m)) return;
    const start = m.crystals;
    const s = endlessSetup(m);
    beginEndless(m);
    const b = botPlay(new Battle(1, s));
    const purse = new Purse();
    const pay = (wave: number) => purse.settle(m, { stage: s.stage, won: false, wave, kills: b.kills }, { crystals: endlessPay(m, wave), firstClear: false, unlocked: [] });
    pay(b.wave);
    bookEndless(m, b.wave);
    const firstWave = b.wave;
    expect(b.revive()).toBe(true);
    botPlay(b);
    pay(b.wave);
    bookEndless(m, b.wave);
    expect(m.endless.runs).toBe(1);
    expect(m.endless.best).toBe(Math.max(firstWave, b.wave));
    expect(purse.paid).toBe(endlessPay(m, b.wave));
    sane(m, start);
  });
});
