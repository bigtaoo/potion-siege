import '../view/layout/measure';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { newMeta } from '../sim/meta';
import { WALL_BOTTOM } from '../view/battleView/wall';
import { Button } from '../view/ui';
import { onField, summonStep, tapToSummon } from './tutorialTap';
import { englishPage, veteran, world } from './testWorld';

beforeAll(englishPage);

describe('onField', () => {
  it('takes the ground and the wall, not the buttons and commander under it', () => {
    expect(onField(540, 600)).toBe(true);
    expect(onField(540, WALL_BOTTOM - 1)).toBe(true);
    expect(onField(540, WALL_BOTTOM + 100)).toBe(false);
    expect(onField(-10, 600)).toBe(false);
    expect(onField(1100, 600)).toBe(false);
  });
});

/** The page's key listeners, on a stand-in window. */
let keys: ((e: KeyboardEvent) => void)[] = [];
const realWindow = (globalThis as { window?: unknown }).window;
beforeEach(() => {
  keys = [];
  (globalThis as { window?: unknown }).window = { addEventListener: (_type: string, l: (e: KeyboardEvent) => void) => keys.push(l) };
});
afterEach(() => {
  (globalThis as { window?: unknown }).window = realWindow;
});

/** A new player's first battle with its taps wired, the summons counted. */
function first(save = newMeta()) {
  const w = world(save);
  const g = w.game;
  tapToSummon(g);
  let summons = 0;
  if (g.battle) {
    const summon = g.battle.summon.bind(g.battle);
    g.battle.summon = () => (summons++, summon());
  }
  /** A tap at `(x, y)` in the battle view's units, landing on `target`. */
  const tap = (x: number, y: number, target: Container = g.view) => w.stage.emit('pointerdown', { global: g.view.toGlobal({ x, y }), target } as never);
  const key = (code: string, repeat = false) => {
    let prevented = false;
    keys.forEach((l) => l(({ code, repeat, preventDefault: () => (prevented = true) }) as unknown as KeyboardEvent));
    return prevented;
  };
  return { w, g, tap, key, summons: () => summons };
}

describe('summonStep', () => {
  it('is up while the summon step points with nothing over the battle', () => {
    const { g } = first();
    expect(summonStep(g)).toBe(true);
  });

  it.each([
    ['the board is hidden', (g: Game) => (g.root.visible = false)],
    ['the skill cards are up', (g: Game) => (g['overlay'].visible = true)],
    ['the pause is open', (g: Game) => (g.pause.open = true)],
    ['the tutorial is over', (g: Game) => (g.tutorial = null)],
    ['the step moved on', (g: Game) => (g.tutorial!.step = 'merge')],
  ])('is down when %s', (_, change) => {
    const { g } = first();
    change(g);
    expect(summonStep(g)).toBe(false);
  });

  it('is down with no battle', () => {
    const { g } = first(veteran());
    expect(summonStep(g)).toBe(false);
  });
});

describe('tapToSummon', () => {
  it('summons for a tap on the field or the wall during the summon step', () => {
    const { tap, summons } = first();
    tap(540, 600);
    expect(summons()).toBe(1);
    tap(540, WALL_BOTTOM - 1);
    expect(summons()).toBe(2);
  });

  it('leaves a tap below the wall, on a button or on the tutorial card to them', () => {
    const { g, tap, summons } = first();
    tap(540, WALL_BOTTOM + 100);
    tap(540, 600, g.lessons);
    expect(g.hud['summonButton']).toBeInstanceOf(Button);
    tap(540, 600, g.hud['summonButton'].children[0]);
    expect(summons()).toBe(0);
  });

  it('does nothing once the step is done', () => {
    const { g, tap, key, summons } = first();
    g.tutorial!.step = 'merge';
    tap(540, 600);
    expect(key('Space')).toBe(false);
    expect(summons()).toBe(0);
  });

  it('summons on the space bar, held keys and other keys left alone', () => {
    const { key, summons } = first();
    expect(key('Space')).toBe(true);
    expect(summons()).toBe(1);
    expect(key('Space', true)).toBe(false);
    expect(key('Enter')).toBe(false);
    expect(summons()).toBe(1);
  });

  it('takes the whole screen for its taps', () => {
    const { g } = first();
    expect(g.app.stage.eventMode).toBe('static');
    expect(g.app.stage.hitArea).toBe(g.app.screen);
  });
});
