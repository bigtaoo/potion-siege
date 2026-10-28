import { Container, type Sprite } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { Battle } from '../../sim/battle';
import { stageField } from '../../sim/chapters';
import { endlessSetup } from '../../sim/endless';
import { battleSetup, newMeta } from '../../sim/meta';
import { BALANCE } from '../../sim/types';
import { fieldTexture } from '../art';
import { fakeArt, fakeFields } from '../fakeArt';
import { FieldArt, fieldOf } from './field';

const FADE = 1.6;
const [FIRST, SECOND, THIRD] = BALANCE.chapters.map((c) => c.bg);

function field() {
  const f = new FieldArt();
  const view = new Container();
  view.addChild(f.ground);
  f.build(view);
  const [art, next] = view.children as Sprite[];
  return { f, view, art, next };
}

describe('the ground under a battle', () => {
  it('is the stage\'s chapter, or in endless mode the chapter of the wave\'s band', () => {
    const stage = new Battle(1, battleSetup(newMeta(), 1));
    expect(fieldOf(stage)).toBe(stageField(1));
    const endless = new Battle(1, endlessSetup(newMeta()));
    const every = BALANCE.endless.chapterEvery;
    expect([1, every, every + 1, every * BALANCE.chapters.length + 1].map((w) => fieldOf(endless, w))).toEqual([FIRST, FIRST, SECOND, FIRST]);
  });

  it('is drawn as shapes while there is no art', () => {
    const { f, view } = field();
    expect(view.children).toEqual([f.ground]);
    expect(f.ground.bounds.height).toBeGreaterThan(0);
    f.update(FADE);
    expect(view.children.length).toBe(1);
  });

  describe('with the art', () => {
    beforeAll(async () => {
      await fakeArt();
      await fakeFields(BALANCE.chapters.map((c) => c.bg));
    });

    it('lays the field art under the ground, with the next one waiting hidden', () => {
      const { f, view, art, next } = field();
      expect(view.children.length).toBe(3);
      expect(view.children[2]).toBe(f.ground);
      expect(art.texture).toBe(fieldTexture());
      expect(next.visible).toBe(false);
    });

    it('swaps in a chapter\'s field at once, or fades it in over the one there', () => {
      const { f, art, next } = field();
      f.show(FIRST);
      expect(art.texture).toBe(fieldTexture(FIRST));
      f.show(SECOND, true);
      expect([next.visible, next.alpha, next.texture]).toEqual([true, 0, fieldTexture(SECOND)]);
      f.update(FADE / 4);
      expect(next.alpha).toBeCloseTo(0.25);
      expect(art.texture).toBe(fieldTexture(FIRST));
      f.update(FADE);
      expect([art.texture, next.visible]).toEqual([fieldTexture(SECOND), false]);
      f.show(SECOND, true);
      expect(next.visible).toBe(false);
    });

    it('lands the fade under way before it starts the next one', () => {
      const { f, art, next } = field();
      f.show(FIRST);
      f.show(SECOND, true);
      f.update(FADE / 2);
      f.show(THIRD, true);
      expect([art.texture, next.texture, next.alpha]).toEqual([fieldTexture(SECOND), fieldTexture(THIRD), 0]);
    });

    it('stops a fade for a new battle', () => {
      const { f, art, next } = field();
      f.show(FIRST);
      f.show(SECOND, true);
      f.reset();
      f.show(FIRST);
      f.update(FADE);
      expect([art.texture, next.visible]).toEqual([fieldTexture(FIRST), false]);
    });

    it('keeps to the last field asked for when an earlier one comes in late', async () => {
      const { f, art } = field();
      const late = 'bg_not_fetched';
      f.show(late);
      f.show(FIRST);
      await Promise.resolve();
      await Promise.resolve();
      expect(f.key).toBe(FIRST);
      expect(art.texture).toBe(fieldTexture(FIRST));
    });
  });
});
