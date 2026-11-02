// The later one-time words in battle (battleTips.ts laterTips) in the real game: the commander's
// drag after its first cast on its own in battles 2-3, the potions flyers fear once one is on the
// field, and the speed button on the first replay, each once a save.
import '../view/layout/measure';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { doCast } from '../sim/commander';
import { GUIDE_LATER } from '../sim/guide';
import { newMeta, type MetaSave } from '../sim/meta';
import { spawn } from '../sim/spawn';
import { englishPage, play, world, type World } from './testWorld';

beforeAll(englishPage);
beforeEach(() => vi.stubGlobal('window', new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

/** A new player after `runs` battles, every home step and earlier battle word behind them. */
function after(runs: number, cleared = runs): MetaSave {
  const m = newMeta();
  m.runs = runs;
  m.tutorial = true;
  m.cleared = cleared;
  m.stage = runs + 1;
  m.guide = ['gift', 'upgrade', 'upgradeMore', 'upgradeLast', 'toBattle1', 'login', 'tasks', 'heroes2', 'workshop', 'toBattle2', ...GUIDE_LATER, 'upgrade2', 'bossCard', 'stars', 'pickTip'];
  return m;
}

const marked = (w: World) => w.events('guide_step').map((e) => e.id);

/** Fills the commander and lets it throw: on its own (`auto`) or by the player's tap. */
function cast(w: World, auto: boolean): void {
  const b = w.game['battle']!;
  spawn(b, { kind: 'grunt', at: 0, hp: 1e9 });
  b.charge = 1_000_000;
  expect(doCast(b, undefined, auto)).toBe(true);
  w.game['tick'](0.001);
}

describe('the later words in battle', () => {
  it('tells battle 2 the commander can be dragged after its first cast on its own, once', () => {
    const w = world(after(1));
    play(w);
    cast(w, true);
    expect(w.game.hud.noted).toBe(t('guide.castTip'));
    expect(marked(w)).toEqual(['castTip']);
  });

  it('says nothing on the drag to a player who casts by hand first', () => {
    const w = world(after(1));
    play(w);
    cast(w, false);
    expect(w.game.hud.noted).toBe('');
    expect(w.game.save.guide).toContain('castTip');
    cast(w, true);
    expect(w.game.hud.noted).toBe('');
  });

  it('keeps the drag line out of later battles', () => {
    const w = world(after(5));
    play(w);
    cast(w, true);
    expect(w.game.hud.noted).toBe('');
    expect(w.game.save.guide).not.toContain('castTip');
  });

  it('names what hits flyers when the first one is on the field', () => {
    const w = world(after(5));
    play(w);
    spawn(w.game['battle']!, { kind: 'flyer', at: 0, hp: 1e9 });
    w.game['tick'](0.001);
    expect(w.game.hud.noted).toBe(t('guide.flyerTip'));
    expect(marked(w)).toEqual(['flyerTip']);
  });

  it('points at the speed button on the first replay of a won stage', () => {
    const m = after(5, 9);
    m.stage = 3;
    const w = world(m);
    play(w);
    w.game['tick'](0.001);
    expect(w.game.hud.noted).toBe(t('guide.speedTip'));
    expect(marked(w)).toEqual(['speedTip']);
  });

  it('keeps quiet on a stage not won yet', () => {
    const w = world(after(5));
    play(w);
    w.game['tick'](0.001);
    expect(w.game.hud.noted).toBe('');
  });
});
