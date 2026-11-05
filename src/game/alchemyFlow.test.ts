// The late-game flows through the real game (testWorld.ts): a tower run booking the week's best
// floor, the rebrew and a weekly task's claim from their buttons' actions, the result screen's
// ways round a stuck stage, and a battle's reactions counted toward the week.
import '../view/layout/measure';
import { Container } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { newMeta } from '../sim/meta';
import { suggestLineup } from '../sim/stuck';
import { BALANCE, REACTION_IDS } from '../sim/types';
import { weekGoal, weekReward } from '../sim/week';
import { doClaimWeek, doRebrew } from './alchemyActions';
import { countDaily } from './countDaily';
import { home } from './homeScreen';
import { englishPage, flush, playToEnd, tap, veteran, world, type World } from './testWorld';
import { exitsFor, takeExit } from './stuckExits';

beforeAll(async () => {
  await englishPage();
  (globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };
});

/** Starts a tower run from the battle tab's endless button. */
function climb(w: World): void {
  w.game['tab'] = 'battle';
  home(w.game);
  tap(w.stage, t('endless.title'));
  expect(w.game['battle']!.setup.endless).toBe(true);
}

describe('the tower and the week', () => {
  it("books the run's last wave as the week's best floor", () => {
    const w = world();
    climb(w);
    playToEnd(w);
    const wave = w.game['battle']!.wave;
    expect(wave).toBeGreaterThan(0);
    expect(w.save().alchemy.week.best).toBe(wave);
  });

  it('books nothing into a week the run did not start in', () => {
    const w = world();
    climb(w);
    // the run began in a week that has since gone
    w.game['endless']!.week = '2000-01-03';
    playToEnd(w);
    expect(w.save().alchemy.week.best).toBe(0);
  });

  it("pays a done task's crystals once", () => {
    const w = world();
    climb(w);
    const g = w.game;
    g.save.alchemy.week.reactions = weekGoal('react');
    const before = g.save.crystals;
    doClaimWeek(g, 'react', new Container());
    doClaimWeek(g, 'react', new Container());
    expect(g.save.crystals).toBe(before + weekReward('react'));
    expect(w.save().alchemy.week.claimed).toEqual(['react']);
  });

  it("counts a battle's reactions toward the week, each kind once", () => {
    const m = newMeta();
    const id = REACTION_IDS[0]!;
    const ev = { type: 'reaction' as const, id, x: 0, y: 0, radius: 1 };
    countDaily(m, [ev, ev]);
    expect(m.alchemy.week.reactions).toBe(2);
    expect(m.alchemy.week.kinds).toEqual([id]);
  });
});

describe('the rebrew', () => {
  it('pours a cleared campaign back for essence and shows stage 1', () => {
    const m = veteran();
    m.cleared = BALANCE.meta.stageCount;
    m.stage = BALANCE.meta.stageCount;
    const w = world(m);
    doRebrew(w.game);
    const after = w.save();
    expect(after.cleared).toBe(0);
    expect(after.alchemy.rebrew.essence).toBeGreaterThan(0);
    expect(after.alchemy.rebrew.peak).toBe(BALANCE.meta.stageCount);
    expect(w.game['tab']).toBe('battle');
    expect(w.events('rebrew')).toHaveLength(1);
  });

  it('does nothing before the campaign is far enough', () => {
    const w = world();
    doRebrew(w.game);
    expect(w.save().cleared).toBe(19);
    expect(w.events('rebrew')).toEqual([]);
  });
});

describe('the ways round a stuck stage', () => {
  it('show from the third loss in a row, and the lineup one fields the tip', async () => {
    const m = veteran();
    m.alchemy.stuck = { stage: 20, n: BALANCE.alchemy.stuck.exitsAfter - 1 };
    const w = world(m);
    expect(exitsFor(w.game, 20, true, false)).toBeUndefined();
    w.game.save.alchemy.stuck.n++;
    expect(exitsFor(w.game, 20, false, false), 'not after a win').toBeUndefined();
    expect(exitsFor(w.game, 20, true, true), 'not in hard mode').toBeUndefined();
    const e = exitsFor(w.game, 20, true, false)!;
    expect(e.tower).toBe(true);
    const tip = suggestLineup(w.game.save);
    expect(e.lineup).toEqual(tip?.lineup ?? null);
    takeExit(w.game, 'lineup');
    await flush();
    if (tip) expect(w.save().lineup).toEqual(tip.lineup);
    expect(w.events('stuck_exit')).toEqual([expect.objectContaining({ kind: 'lineup', stage: 20 })]);
  });
});
