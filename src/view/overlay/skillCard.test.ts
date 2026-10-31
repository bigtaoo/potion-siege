// A skill card's picture (skillCard.ts cardIcon): the drawn medal until the art is in, then the
// painted icon or the potions it belongs to; and its rarity frame.
import '../layout/measure';
import { Sprite } from 'pixi.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { englishPage } from '../../game/testWorld';
import { fakeArt } from '../fakeArt';
import { cardIcon } from './skillCard';

afterAll(() => vi.unstubAllGlobals());

const sprites = (id: Parameters<typeof cardIcon>[0], hero?: Parameters<typeof cardIcon>[1], other?: Parameters<typeof cardIcon>[2]) =>
  cardIcon(id, hero, other)!.children.filter((c): c is Sprite => c instanceof Sprite);

describe('a skill card picture', () => {
  it('is a drawn medal without art, and nothing for a skill with no drawing', () => {
    const drawn = cardIcon('allDamage')!;
    expect(drawn.children.length).toBe(2);
    expect(drawn.children.some((c) => c instanceof Sprite)).toBe(false);
    expect(cardIcon('crit')).toBeNull();
    expect(cardIcon('arcanePower', 'arcane')!.children).toHaveLength(0);
  });

  it('shows the painted icon, the potion, or both of a recipe once the art is in', async () => {
    await fakeArt();
    const [icon] = sprites('crit');
    expect(icon.scale.x).toBe(150);
    const [one] = sprites('arcanePower', 'arcane');
    expect([one.scale.x, one.x, one.y]).toEqual([190, 0, 0]);
    const both = sprites('arcanePower', 'arcane', 'fire');
    expect(both.map((s) => [s.scale.x, s.x, s.y])).toEqual([[140, -40, -14], [150, 38, 14]]);
  });
});

describe('a skill card frame', () => {
  it('is coloured by rarity: white common, blue rare, purple epic, gold recipe', async () => {
    await englishPage();
    const { RARITY_COLORS, skillCard } = await import('./skillCard');
    const rim = (id: Parameters<typeof skillCard>[0]) => skillCard(id, 0).children.find((c) => c.label.startsWith('rarity_'))?.label;
    expect([rim('allDamage'), rim('crit'), rim('fireChain'), rim('fireArcane')]).toEqual(['rarity_common', 'rarity_rare', 'rarity_epic', 'rarity_legend']);
    expect(new Set(Object.values(RARITY_COLORS)).size).toBe(4);
  });
});
