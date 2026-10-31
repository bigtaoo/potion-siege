import { describe, expect, it } from 'vitest';
import { CHAPTER_COUNT } from './chapters';
import { newMeta, parseMeta } from './meta';
import { anyStarChestWaiting, nextStarChest, openStarChests, parseStarChests, STAR_CHESTS, starChestsOpened, starChestsWaiting } from './starChest';

/** A save with `stars` stars spread over chapter `ch`'s stages. */
function withStars(ch: number, stars: number) {
  const m = newMeta();
  m.cleared = ch * 10;
  for (let i = 0; i < 10; i++) m.stars.normal[(ch - 1) * 10 + i] = Math.min(3, Math.max(1, stars - i * 3));
  return m;
}

describe('star chests', () => {
  it('pays each tier once, all the reached ones on one tap', () => {
    const m = withStars(1, 30);
    expect(starChestsWaiting(m, 1)).toBe(3);
    expect(anyStarChestWaiting(m)).toBe(true);
    const before = m.crystals;
    const n = openStarChests(m, 1);
    expect(n).toBe(STAR_CHESTS.reduce((s, c) => s + c.reward, 0));
    expect(m.crystals - before).toBe(n);
    expect(starChestsOpened(m, 1)).toBe(3);
    expect(nextStarChest(m, 1)).toBeNull();
    expect(openStarChests(m, 1)).toBe(0);
    expect(anyStarChestWaiting(m)).toBe(false);
  });

  it('waits for the stars: a chapter of single stars has only its first tier', () => {
    const m = newMeta();
    m.cleared = 10;
    for (let i = 0; i < 10; i++) m.stars.normal[i] = 1;
    expect(starChestsWaiting(m, 1)).toBe(1);
    expect(openStarChests(m, 1)).toBe(STAR_CHESTS[0].reward);
    expect(nextStarChest(m, 1)).toEqual(STAR_CHESTS[1]);
    m.stars.normal[0] = 3;
    expect(starChestsWaiting(m, 1)).toBe(0);
    for (let i = 0; i < 10; i++) m.stars.normal[i] = 2;
    expect(openStarChests(m, 1)).toBe(STAR_CHESTS[1].reward);
  });

  it('ignores hard stars and chapters out of range', () => {
    const m = newMeta();
    m.stars.hard.fill(3);
    expect(anyStarChestWaiting(m)).toBe(false);
    expect(openStarChests(m, 0)).toBe(0);
    expect(openStarChests(m, CHAPTER_COUNT + 1)).toBe(0);
  });

  it('keeps the opened tiers in the save and reads broken ones as none', () => {
    const m = withStars(2, 30);
    openStarChests(m, 2);
    const back = parseMeta(JSON.stringify(m));
    expect(starChestsOpened(back, 2)).toBe(3);
    expect(starChestsOpened(back, 1)).toBe(0);
    expect(parseStarChests('x')).toEqual(new Array(CHAPTER_COUNT).fill(0));
    expect(parseStarChests([9, -2, 'a', 1.7]).slice(0, 4)).toEqual([3, 0, 0, 1]);
    const old = JSON.parse(JSON.stringify(newMeta()));
    delete old.starChests;
    expect(parseMeta(JSON.stringify(old)).starChests).toEqual(new Array(CHAPTER_COUNT).fill(0));
  });
});
