// Every way to play, from the home screen through the battle to its result and back home: a
// story stage lost and a chapter finale (its boss) won, today's challenge and an endless run.
// Each one books into the save what it should, and leaves no NaN or negative number in it.
// The real game over a stand-in Pixi app (testWorld.ts).
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { botAct } from '../sim/bot';
import { dayOf } from '../sim/daily';
import { maxedSave } from '../sim/setupCatalog';
import type { MetaSave } from '../sim/meta';
import { home } from './homeScreen';
import { buttons, englishPage, flush, play, playToEnd, tap, veteran, world, type World } from './testWorld';

beforeAll(async () => {
  await englishPage();
  // the first skill picks' card nudge listens for a touch on the window
  (globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };
});

/** Paths in the stored save to a number that is not a finite one at 0 or above. */
function badNumbers(v: unknown, path = 'save'): string[] {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? [] : [`${path} = ${v}`];
  if (v === null || typeof v !== 'object') return [];
  return Object.entries(v).flatMap(([k, x]) => badNumbers(x, `${path}.${k}`));
}

/** playToEnd with the bot (bot.ts) playing the battle, so a strong save wins it. Needs a world
 *  at real speed (BOT), or the bot acts once per many seconds of battle. */
function botToEnd(w: World): void {
  const g = w.game;
  for (let i = 0; i < 20_000 && !g['ended']; i++) {
    const b = g['battle']!;
    if (b.choices && g['overlay'].visible) g['pick'](b.choices[0]);
    else botAct(b);
    g['tick'](0.1);
  }
  expect(g['ended'], 'the battle ended').toBe(true);
  expect(g['overlay'].visible).toBe(true);
}

const BOT = 'speed=1';

/** From the result screen back to the home screen with its one Continue (or Back) button. */
async function leave(w: World, caption = t('continue')): Promise<void> {
  tap(w.stage, caption);
  await flush();
  expect(w.game['menu'].visible, 'home is up').toBe(true);
  expect(w.game['overlay'].visible).toBe(false);
  expect(badNumbers(w.save())).toEqual([]);
}

describe('each mode, home to result to home', () => {
  it('a lost story stage pays its crystals and counts the run', async () => {
    const w = world();
    const before = w.save();
    play(w);
    playToEnd(w);
    expect(w.game['battle']!.result).toBe('lost');
    await leave(w);
    const after = w.save();
    expect(after.runs).toBe(before.runs + 1);
    expect(after.crystals).toBeGreaterThan(before.crystals);
    expect(after.bestWave).toBeGreaterThanOrEqual(w.game['battle']!.wave);
  });

  it('a chapter finale won (its boss down) clears the stage and opens the chest', async () => {
    const m: MetaSave = { ...maxedSave(), cleared: 9, stage: 10, chapterChests: [], runs: 9, tutorial: true, upgradeHint: true };
    const w = world(m, () => {}, BOT);
    play(w);
    botToEnd(w);
    expect(w.game['battle']!.result).toBe('won');
    // past the first battles a win offers no Next Stage, only the way home
    expect(buttons(w.stage, t('nextStage'))).toHaveLength(0);
    await leave(w);
    const after = w.save();
    expect(after.cleared).toBe(10);
    expect(after.stage).toBe(11);
    expect(after.chapterChests).toContain(1);
  });

  it('an early win goes straight into the next stage', async () => {
    const m: MetaSave = { ...maxedSave(), cleared: 1, stage: 2, runs: 1, tutorial: true, upgradeHint: true };
    const w = world(m, () => {}, BOT);
    play(w);
    botToEnd(w);
    tap(w.stage, t('nextStage'));
    await flush();
    expect(w.game['menu'].visible).toBe(false);
    expect(w.game['battle']!.setup.stage).toBe(3);
    expect(w.game['battle']!.result).toBeNull();
  });

  it("today's challenge books the attempt and its best wave", async () => {
    const w = world();
    home(w.game, 'challenge');
    tap(w.stage, t('challenge.go'));
    expect(w.game['menu'].visible).toBe(false);
    expect(w.game['battle']!.canSummon(), 'a summon on offer at the start').toBe(true);
    playToEnd(w);
    const wave = w.game['battle']!.wave;
    // no revive and no ×2 in the challenge: Continue is the one way on
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
    await leave(w);
    const c = w.save().challenge;
    expect(c.date).toBe(dayOf(new Date()));
    expect(c.attempts).toBe(1);
    expect(c.best).toBe(wave);
    expect(c.streak).toBe(1);
  });

  it('an endless run books its best wave and its run, and pays for its waves', async () => {
    const w = world();
    const before = w.save();
    w.game['tab'] = 'battle';
    home(w.game);
    tap(w.stage, t('endless.title'));
    expect(w.game['menu'].visible).toBe(false);
    expect(w.game['battle']!.setup.endless).toBe(true);
    playToEnd(w);
    const wave = w.game['battle']!.wave;
    await leave(w);
    const after = w.save();
    expect(after.endless.runs).toBe(1);
    expect(after.endless.best).toBe(wave);
    expect(after.crystals).toBeGreaterThan(before.crystals);
  });

  it('a revived endless run ends again and still leads home', async () => {
    const w = world();
    w.game['tab'] = 'battle';
    home(w.game);
    tap(w.stage, t('endless.title'));
    playToEnd(w);
    const first = w.game['battle']!.wave;
    w.host.answers = ['watched'];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game['battle']!.result).toBeNull();
    playToEnd(w);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
    await leave(w);
    const after = w.save();
    expect(after.endless.runs, 'a revived run is still one run').toBe(1);
    expect(after.endless.best).toBeGreaterThanOrEqual(first);
  });
});

describe('a save that has played every mode', () => {
  it('reads back as it was stored', async () => {
    const { parseMeta } = await import('../sim/meta');
    const w = world(veteran());
    play(w);
    playToEnd(w);
    await leave(w);
    home(w.game, 'challenge');
    tap(w.stage, t('challenge.go'));
    playToEnd(w);
    await leave(w);
    const stored = w.save();
    expect(parseMeta(JSON.stringify(stored))).toEqual(stored);
  });
});
