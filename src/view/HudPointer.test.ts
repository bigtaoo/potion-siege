// The Hud's rarer paths: a boss card drawn over the last one, and the pointer at a pair on
// a field turned on its side and with the painted glove (Hud.ts). Its own file: fakeArt is global.
import './layout/measure';
import { Container, Sprite, type Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { endlessSetup } from '../sim/endless';
import { battleSetup, newMeta } from '../sim/meta';
import { BALANCE, HERO_KINDS, type BattleEvent } from '../sim/types';
import { endlessBoss } from '../sim/waves';
import { t } from '../i18n';
import { fakeArt } from './fakeArt';
import { Hud } from './Hud';

function hud(b: Battle) {
  const h = new Hud(() => {}, () => {}, () => {});
  h.attach(b);
  return h;
}

/** A full grid with a pair to fuse in its first two open cells, and gold for a summon. */
function fullWithPair(b: Battle): void {
  const open = b.slots.map((_, i) => i).filter((i) => b.isOpen(i));
  open.forEach((slot, i) => {
    const kind = i < 2 ? HERO_KINDS[0] : HERO_KINDS[i % HERO_KINDS.length];
    const star = i < 2 ? 1 : 2 + Math.floor(i / HERO_KINDS.length);
    b.slots[slot] = { id: 100 + i, kind, star, slot, cooldown: 0 } as Battle['slots'][number];
  });
  b.gold = b.summonCost() * 10;
}

describe('the boss card', () => {
  it('draws afresh for the next endless visitor, clearing the last one', () => {
    const count = BALANCE.waves.count;
    const every = BALANCE.endless.bossEvery;
    const h = hud(new Battle(1, endlessSetup(newMeta())));
    const card = h['bossCard'] as Container;
    h.react([{ type: 'wave', wave: count + every, boss: true } as BattleEvent]);
    const first = card.children[0];
    h.react([{ type: 'wave', wave: count + every * 2, boss: true } as BattleEvent]);
    expect(endlessBoss(count + every * 2)).not.toBe(endlessBoss(count + every));
    expect(first.destroyed).toBe(true);
    expect(card.children.length).toBeGreaterThan(3);
  });
});

describe('the pointer at a pair', () => {
  it('rings the cells where they lie on a field turned on its side', () => {
    const upright = hud(new Battle(1, battleSetup(newMeta(), 1)));
    fullWithPair(upright['battle']!);
    upright.update(2.1);
    const turned = hud(new Battle(1, battleSetup(newMeta(), 1)));
    const field = new Container();
    field.rotation = Math.PI / 2;
    field.position.set(1000, 0);
    turned.field = field;
    turned.place(700);
    fullWithPair(turned['battle']!);
    turned.update(2.1);
    const rings = (h: Hud) => (h['nudgeRings'] as Graphics).bounds;
    expect((turned['nudgeHand'] as Container).visible).toBe(true);
    expect(rings(turned).width).not.toBeCloseTo(rings(upright).width);
  });

  it('fades the hand out at the end of each drag, and wears the painted glove once it is in', async () => {
    const h = hud(new Battle(1, battleSetup(newMeta(), 1)));
    fullWithPair(h['battle']!);
    const hand = h['nudgeHand'] as Container;
    h.update(2.1);
    expect(hand.children[0]).not.toBeInstanceOf(Sprite);
    h.update(1.4);
    expect(hand.alpha).toBeGreaterThan(0);
    expect(hand.alpha).toBeLessThan(1);
    await fakeArt();
    h.update(0.1);
    const glove = hand.children[0];
    expect(glove).toBeInstanceOf(Sprite);
    h.update(0.1);
    expect(hand.children[0]).toBe(glove);
  });
});

describe('召唤 pulsing again after the tutorial', () => {
  const scale = (h: Hud) => (h['summonButton'] as Container).scale.x;
  /** A battle with gold for a summon and cells free, its clock at `secs` idle. */
  function idle(secs: number, over: Partial<Hud> = {}) {
    const h = hud(new Battle(1, battleSetup(newMeta(), 1)));
    Object.assign(h, over);
    h['battle']!.gold = h['battle']!.summonCost() * 3;
    h.update(secs);
    h.update(0.3);
    return h;
  }

  it('swells once a new player could summon for 4 s and has not', () => {
    expect(scale(idle(3.5))).toBe(1);
    expect(scale(idle(4))).toBeGreaterThan(1);
  });

  it('starts the wait over at each summon', () => {
    const h = idle(4);
    const b = h['battle']!;
    b.summon();
    h.update(0.3);
    expect(scale(h)).toBe(1);
    h.update(3.5);
    expect(scale(h)).toBe(1);
  });

  it('stays still for a veteran, during the tutorial and with no gold for a summon', () => {
    expect(scale(idle(5, { veteran: true }))).toBe(1);
    expect(scale(idle(5, { nudge: false }))).toBe(1);
    const h = hud(new Battle(1, battleSetup(newMeta(), 1)));
    h['battle']!.gold = 0;
    h.update(5);
    h.update(0.3);
    expect(scale(h)).toBe(1);
  });
});

describe('the hand on 召唤 after the tutorial', () => {
  const hand = (h: Hud) => h['nudgeHand'] as Container;
  function idle(secs: number, over: Partial<Hud> = {}) {
    const h = hud(new Battle(1, battleSetup(newMeta(), 1)));
    Object.assign(h, over);
    h['battle']!.gold = h['battle']!.summonCost() * 3;
    h.update(secs);
    h.update(0.3);
    return h;
  }

  it('taps the button alone, with no rings, arc or merge hint, once a new player idles 4 s', () => {
    expect(hand(idle(3.5)).visible).toBe(false);
    const h = idle(4);
    const button = h['summonButton'] as Container;
    expect(hand(h).visible).toBe(true);
    expect((h['nudgeRings'] as Container).visible).toBe(false);
    expect((h['nudgeArc'] as Container).visible).toBe(false);
    expect((h['hintText'] as { text: string }).text).not.toBe(t('full.hint'));
    expect(Math.hypot(hand(h).x - button.x, hand(h).y - button.y)).toBeLessThanOrEqual(26);
    expect(h.children.indexOf(hand(h))).toBeGreaterThan(h.children.indexOf(button));
  });

  it('goes at a summon and stays away for a veteran or during the tutorial', () => {
    const h = idle(4);
    h['battle']!.summon();
    h.update(0.3);
    expect(hand(h).visible).toBe(false);
    expect(hand(idle(5, { veteran: true })).visible).toBe(false);
    expect(hand(idle(5, { nudge: false })).visible).toBe(false);
  });
});
