import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { englishPage, texts } from '../../game/testWorld';
import { STARS } from '../../sim/stars';
import { starNotes } from './endStars';

beforeAll(englishPage);

const notes = (stars: number, before: number, hard = false, opened = 0) =>
  starNotes({ stars, before, hard, opened }, 700).map((s) => ({ h: s.h, words: texts(s.c) }));
const rule = () => t('stars.rule', { p: Math.round(STARS.three * 100) });

describe('star notes', () => {
  it('say nothing without a win\'s stars', () => {
    expect(starNotes(undefined, 700)).toEqual([]);
    expect(notes(0, 2)).toEqual([]);
  });

  it('only tell what three stars take on a first normal win', () => {
    expect(notes(2, 0)).toEqual([{ h: 60, words: [rule()] }]);
  });

  it('cheer a new best, and stop telling the rule once three are had', () => {
    expect(notes(3, 2)).toEqual([{ h: 110, words: [t('stars.best')] }]);
    expect(notes(2, 1).map((n) => n.words[0])).toEqual([t('stars.best'), rule()]);
    expect(notes(1, 3)).toEqual([]);
  });

  it('mark a first hard win rather than a best', () => {
    expect(notes(3, 0, true).map((n) => n.words[0])).toEqual([t('stars.hardFirst')]);
  });

  it('tell when a chapter\'s hard mode opened', () => {
    expect(notes(3, 0, false, 2)).toEqual([{ h: 110, words: [t('stars.hardOpen', { n: 2 })] }]);
  });

  it('shrink the rule to the board\'s width', () => {
    const [hint] = starNotes({ stars: 1, before: 0, hard: false, opened: 0 }, 120);
    expect(hint.c.width).toBeLessThanOrEqual(120.01);
  });
});
