import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { REACTION_IDS } from '../../sim/types';
import { Floaters } from './floaters';
import { FxLayer } from './fxLayer';
import { REACTION_COLORS, REACTION_TIME, ReactionFx, reactionRing } from './reactionFx';

const shown = (f: Floaters): number => f.children.filter((c) => c.visible).length;

describe('the reactions as drawn', () => {
  it('names each kind over the field the first time in a battle, then only rings it', () => {
    const rx = new ReactionFx();
    const fx = new FxLayer();
    const floaters = new Floaters();
    rx.show(fx, floaters, 'steam', 500, 600, 90);
    rx.show(fx, floaters, 'steam', 520, 600, 90);
    rx.show(fx, floaters, 'overload', 300, 400, 80);
    expect(shown(floaters)).toBe(2);
    expect(fx.mid.bounds.width).toBe(0);
    fx.update(REACTION_TIME / 2);
    expect(fx.mid.bounds.width).toBeGreaterThan(80);
    // a new battle names them again
    rx.clear();
    floaters.hideAll();
    rx.show(fx, floaters, 'steam', 500, 600, 90);
    expect(shown(floaters)).toBe(1);
    fx.update(REACTION_TIME);
    expect(fx.mid.bounds.width).toBe(0);
  });

  it('gives every reaction its colours and draws each, resonance with no reach as well', () => {
    expect(new Set(REACTION_IDS.map((id) => REACTION_COLORS[id][0])).size).toBe(REACTION_IDS.length);
    for (const id of REACTION_IDS) {
      const g = new Graphics();
      reactionRing(g, id, 0, 0, id === 'resonance' ? 0 : 90, 0.5);
      expect(g.bounds.width).toBeGreaterThan(30);
    }
  });
});
