import './layout/measure';
import { describe, expect, it } from 'vitest';
import type { Container, Text } from 'pixi.js';
import { t } from '../i18n';
import { Battle } from '../sim/battle';
import { endlessSetup } from '../sim/endless';
import { battleSetup, newMeta } from '../sim/meta';
import { TICK_RATE } from '../sim/math/fixed';
import { BALANCE, HERO_KINDS, type BattleEvent } from '../sim/types';
import { FIRST_STAGE, FIRST_WAVE } from '../sim/waves';
import { COIN_TARGET } from './battleView/killFx';
import { Hud } from './Hud';
import type { Button } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';

const wave = (n: number, boss = false): BattleEvent => ({ type: 'wave', wave: n, boss }) as BattleEvent;

function hud(battle = new Battle(1, battleSetup(newMeta(), 1))) {
  const h = new Hud(() => {}, () => {}, () => {});
  h.attach(battle);
  const banner = h['banner'] as Text;
  const newcomer = h['newcomer'] as Text;
  const card = h['bossCard'] as Container;
  const summon = h['summonButton'] as Button;
  const upgrade = h['upgradeButton'] as Button;
  const pointing = () => (h['nudgeHand'] as Container).visible;
  return { h, b: battle, banner, newcomer, card, summon, upgrade, pointing };
}

const stage = (n: number) => new Battle(1, battleSetup(newMeta(), n));
const endless = () => new Battle(1, endlessSetup(newMeta()));
const at = (b: Battle, seconds: number) => (b.time = seconds * TICK_RATE);

/** Every open cell taken; with a pair to fuse in the first two, or none at all. */
function fill(b: Battle, pair: boolean): void {
  const open = b.slots.map((_, i) => i).filter((i) => b.isOpen(i));
  open.forEach((slot, i) => {
    const kind = pair && i < 2 ? HERO_KINDS[0] : HERO_KINDS[i % HERO_KINDS.length];
    const star = pair && i < 2 ? 1 : 2 + Math.floor(i / HERO_KINDS.length);
    b.slots[slot] = { id: 100 + i, kind, star, slot, cooldown: 0 } as Battle['slots'][number];
  });
}

describe('the wave banner', () => {
  it('names the wave high on the field, and fades out', () => {
    const { h, banner } = hud();
    h.react([wave(2)]);
    expect([banner.text, banner.y]).toEqual([t('wave', { n: 2, total: BALANCE.waves.count }), 270]);
    h.update(0.5);
    expect(banner.alpha).toBe(1);
    h.update(1);
    expect(banner.alpha).toBeCloseTo(0.5);
    h.update(1);
    expect(banner.alpha).toBe(0);
  });

  it('calls a boss wave lower down, out of the boss\'s way, and the horde on the first wave', () => {
    const { h, banner } = hud();
    h.react([wave(5, true)]);
    expect([banner.text, banner.y]).toEqual([t('bossWave'), 620]);
    h.react([wave(1)]);
    expect([banner.text, banner.y]).toEqual([t('hordeWave'), 270]);
  });

  it('counts the waves with no last one in endless mode', () => {
    const { h, banner } = hud(endless());
    h.react([wave(23)]);
    expect(banner.text).toBe(t('waveEndless', { n: 23 }));
  });

  it('holds while the battle is paused', () => {
    const { h, b, banner } = hud();
    h.react([wave(2)]);
    b.choices = [] as never;
    h.update(5);
    expect(banner.alpha).toBe(0);
    b.choices = null;
    h.react([wave(3)]);
    b.choices = [] as never;
    h.update(1);
    // a pause starts the banner's time over rather than keeping it
    expect(banner.alpha).toBe(0);
  });

  it('shrinks a long line to stay on the board, and lets the tutorial say things in its place', () => {
    const { h, banner } = hud();
    h.say('done');
    expect([banner.text, banner.scale.x]).toEqual(['done', 1]);
    h.say('a very long line that would never fit across the board at this size');
    h.update(0);
    expect(banner.width).toBeLessThan(DESIGN_W);
  });
});

describe('the newcomer line and the boss card', () => {
  it('names a kind on the stage and wave it first comes in, with what it is weak to', () => {
    const { h, newcomer } = hud(stage(FIRST_STAGE.flyer));
    h.react([wave(FIRST_WAVE.flyer - 1)]);
    expect(newcomer.text).toBe('');
    h.react([wave(FIRST_WAVE.flyer)]);
    expect(newcomer.text).toContain(t('enemy.flyer'));
    h.update(0);
    expect(newcomer.alpha).toBe(1);
  });

  it('says nothing of a kind on a later stage', () => {
    const { h, newcomer } = hud(stage(FIRST_STAGE.flyer + 1));
    h.react([wave(FIRST_WAVE.flyer)]);
    expect(newcomer.text).toBe('');
  });

  it('shows a new chapter boss on its card instead of the line, fading with it', () => {
    const { h, b, newcomer, card } = hud(stage(FIRST_STAGE.clock));
    h.react([wave(FIRST_WAVE.clock, true)]);
    expect(newcomer.text).toBe('');
    expect(card.children.length).toBeGreaterThan(3);
    expect(card.y).toBe(850);
    h.update(0);
    expect(card.scale.x).toBeGreaterThan(1);
    h.update(4.5);
    expect(card.alpha).toBeCloseTo(0.5);
    b.choices = [] as never;
    h.update(1);
    expect(card.alpha).toBeCloseTo(0.5);
    b.choices = null;
    h.update(1);
    expect(card.alpha).toBe(0);
    h.attach(b);
    expect(card.children.length).toBe(0);
  });

  it('gives the first chapter\'s boss no card: the player met it there', () => {
    const { h, card } = hud(stage(1));
    h.react([wave(5, true)]);
    expect(card.children.length).toBe(0);
  });

  it('in endless mode, cards each other chapter\'s boss on its first lap only', () => {
    const { h, card } = hud(endless());
    const every = BALANCE.endless.bossEvery;
    const count = BALANCE.waves.count;
    h.react([wave(count, true)]);
    expect(card.children.length).toBe(0);
    h.react([wave(count + every, true)]);
    expect(card.children.length).toBeGreaterThan(0);
    const later = hud(endless());
    later.h.react([wave(count + every * 6, true)]);
    expect(later.card.children.length).toBe(0);
  });

  it('in endless mode, says where the run goes on as it reaches the next chapter\'s field', () => {
    const { h, newcomer } = hud(endless());
    const every = BALANCE.endless.chapterEvery;
    h.react([wave(every)]);
    expect(newcomer.text).toBe('');
    h.react([wave(every + 1)]);
    expect(newcomer.text).toBe(t('endlessChapter', { name: t(`chapter.name.${BALANCE.chapters[1].id}` as never) }));
  });
});

describe('the summon button', () => {
  it('shows its cost, or on a full grid what to do instead', () => {
    const { h, b, summon } = hud();
    h.update(0);
    expect(summon.text.text).toBe(`${t('summon')}\n● ${b.summonCost()}`);
    fill(b, true);
    h.update(0);
    expect(summon.text.text).toBe(t('full.merge'));
    fill(b, false);
    h.update(0);
    expect(summon.text.text).toBe(t('full.upgrade'));
  });

  it('keeps both captions on their buttons', () => {
    const { h, summon, upgrade } = hud();
    h.legible(3);
    h.update(0);
    for (const btn of [summon, upgrade]) expect(btn.text.width).toBeLessThan(320);
  });
});

describe('the pointer at a pair on a full grid', () => {
  const rich = (b: Battle) => (b.gold = b.summonCost() * 10);

  it('points after the grid has been full a while with gold for a summon, and says what to do', () => {
    const { h, b, pointing } = hud();
    fill(b, true);
    rich(b);
    h.update(1.5);
    expect(pointing()).toBe(false);
    h.update(0.6);
    expect(pointing()).toBe(true);
    expect((h['hintText'] as Text).text).toBe(t('full.hint'));
    expect((h['hintBox'] as Container).visible).toBe(true);
    b.slots[b.slots.findIndex((s) => s)] = null;
    h.update(0.1);
    expect(pointing()).toBe(false);
  });

  it('waits while there is no gold for a summon, or nothing to fuse', () => {
    const { h, b, pointing } = hud();
    fill(b, true);
    b.gold = 0;
    h.update(3);
    expect(pointing()).toBe(false);
    fill(b, false);
    rich(b);
    h.update(3);
    expect(pointing()).toBe(false);
  });

  it('points for a veteran only once the grey summon button is tapped, and no plate says why', () => {
    const { h, b, summon, pointing } = hud();
    h.veteran = true;
    h.hint = false;
    fill(b, true);
    rich(b);
    h.update(3);
    expect(pointing()).toBe(false);
    summon.emit('pointertap', {} as never);
    h.update(0.01);
    expect(pointing()).toBe(true);
    expect((h['hintBox'] as Container).visible).toBe(false);
    // asked stays until a cell frees up
    b.slots[b.slots.findIndex((s) => s)] = null;
    h.update(0.01);
    fill(b, true);
    h.update(0.01);
    expect(pointing()).toBe(false);
  });

  it('shakes the grey button on a tap, and does not point on a grid with room', () => {
    const { h, b, summon, pointing } = hud();
    b.gold = 0;
    h.update(0);
    summon.emit('pointertap', {} as never);
    h.update(0.01);
    expect(summon.x).not.toBe(DESIGN_W - 190);
    expect(pointing()).toBe(false);
    h.update(1);
    expect(summon.x).toBe(DESIGN_W - 190);
  });

  it('leaves the pointing to the tutorial while it runs', () => {
    const { h, b, pointing } = hud();
    h.nudge = false;
    fill(b, true);
    rich(b);
    h.update(3);
    expect(pointing()).toBe(false);
  });
});

describe('the opening hint', () => {
  it('shows until a merge or its time is up, and makes way for a challenge\'s chips', () => {
    const { h, b } = hud();
    const box = h['hintBox'] as Container;
    h.update(0);
    expect(box.visible).toBe(true);
    at(b, 24.5);
    h.update(0);
    expect(box.alpha).toBeCloseTo(0.5);
    at(b, 30);
    h.update(0);
    expect(box.visible).toBe(false);
    at(b, 0);
    h.showMods(['swift'], null);
    h.update(0);
    expect(box.visible).toBe(false);
    h.showMods([], null);
    h.react([{ type: 'merge' } as BattleEvent]);
    h.update(0);
    expect(box.visible).toBe(false);
  });
});

describe('the speed and pause buttons', () => {
  it('offers 1.5x on a stage won before, off at the start, and drops the hint for it', () => {
    const { h, b } = hud();
    const speed = h['speedButton'] as Container;
    h.fast = true;
    h.offerSpeed(true);
    h.update(0);
    expect([speed.visible, h.fast, h.hint]).toEqual([true, false, false]);
    b.result = 'won' as never;
    h.update(0);
    expect([speed.visible, (h['pauseButton'] as Container).visible]).toEqual([false, false]);
  });

  it('keeps it hidden on a stage not won yet', () => {
    const { h } = hud();
    h.offerSpeed(false);
    h.update(0);
    expect((h['speedButton'] as Container).visible).toBe(false);
    expect(h.hint).toBe(true);
  });
});

describe('the layout', () => {
  it('puts the buttons in the band under a field on its side, and back at the bottom upright', () => {
    const { h, summon, upgrade } = hud();
    h.place(700);
    expect([summon.y, upgrade.y]).toEqual([700, 700]);
    expect(h.buttonRect('summon')).toEqual({ x: DESIGN_W - 190 - 160, y: 700 - 75, w: 320, h: 150 });
    h.place(null);
    expect(summon.y).toBe(DESIGN_H - 120);
    expect(h.buttonRect('upgrade').x).toBe(190 - 160);
  });

  it('sends the kills\' coins to the counter, wherever it sits', () => {
    const { h } = hud();
    h.place(null);
    h.legible(1, true);
    expect({ ...COIN_TARGET }).toEqual({ x: 90, y: 60 });
    h.place(700);
    // in the view's turned units on a field on its side
    expect({ ...COIN_TARGET }).toEqual({ x: 700, y: DESIGN_H + 150 });
  });

  it('grows the small words for a small board, the top line no more than 1.25 times', () => {
    const { h } = hud();
    h.legible(2);
    expect((h['waveText'] as Text).scale.x).toBe(1.25);
    expect((h['pauseButton'] as Container).position).toMatchObject({ x: DESIGN_W - 62 * 1.25, y: 62 * 1.25 });
    expect((h['hintBox'] as Container).scale.x).toBe(1.3);
    h.legible(1);
    expect((h['waveText'] as Text).scale.x).toBe(1);
  });

  it('bumps the coin as a kill\'s coin lands on it, and settles it back', () => {
    const { h } = hud();
    const coin = h['coin'] as Container;
    h.coinLanded();
    h.update(0);
    expect(coin.scale.x).toBeCloseTo(1.3);
    h.update(0.1);
    expect(coin.scale.x).toBeGreaterThan(1);
    h.update(1);
    expect(coin.scale.x).toBe(1);
  });

  it('draws nothing before a battle is attached', () => {
    const h = new Hud(() => {}, () => {}, () => {});
    expect(() => h.update(0.1)).not.toThrow();
  });
});
