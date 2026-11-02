import { describe, expect, it } from 'vitest';
import { GUIDE_CHAPTERS, GUIDE_ONCE, guideChapter, guideLeft, markGuide, parseGuide, toBattle } from './guide';
import { newMeta, parseMeta } from './meta';

const ALL = [...GUIDE_CHAPTERS.flat(), ...GUIDE_ONCE];

describe('the home guide in the save', () => {
  it('is on the chapter after each of the first three battles, none before or after', () => {
    const m = newMeta();
    expect([0, 1, 2, 3, 4, 9].map((runs) => guideChapter({ ...m, runs }))).toEqual([null, 1, 2, 3, null, null]);
  });

  it("leaves the chapter's steps not done or skipped, in order, ending at the start button", () => {
    const m = newMeta();
    m.runs = 2;
    expect(guideLeft(m)).toEqual(['login', 'tasks', 'workshop', 'toBattle2']);
    expect(markGuide(m, 'tasks')).toBe(true);
    expect(markGuide(m, 'tasks')).toBe(false);
    expect(guideLeft(m)).toEqual(['login', 'workshop', 'toBattle2']);
    expect([1, 2, 3].map((ch) => toBattle(ch as 1 | 2 | 3))).toEqual(['toBattle1', 'toBattle2', 'toBattle3']);
    m.runs = 0;
    expect(guideLeft(m)).toEqual([]);
  });

  it('reads back known ids once each, and counts a played save from before it as done', () => {
    expect(parseGuide(['gift', 'gift', 'nope', 3, 'stars'], 2)).toEqual(['gift', 'stars']);
    expect(parseGuide(undefined, 0)).toEqual([]);
    expect(parseGuide(undefined, 5)).toEqual(ALL);
  });

  it('survives a save round trip, and a save without it is filled in by its runs', () => {
    const m = newMeta();
    m.runs = 1;
    m.guide = ['gift', 'upgrade'];
    expect(parseMeta(JSON.stringify(m)).guide).toEqual(['gift', 'upgrade']);
    const old = JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
    delete old.guide;
    expect(parseMeta(JSON.stringify(old)).guide).toEqual(ALL);
    expect(parseMeta(JSON.stringify({ ...old, runs: 0 })).guide).toEqual([]);
    expect(newMeta().guide).toEqual([]);
  });
});
