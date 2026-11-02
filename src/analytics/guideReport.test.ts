import { describe, expect, it } from 'vitest';
import { GUIDE_ORDER, guideRows, printGuide } from '../../scripts/guideReport.mjs';
import { GUIDE_CHAPTERS, GUIDE_LATER, GUIDE_ONCE } from '../sim/guide';

const step = (uid: string, id: string, result: string, waitS = 0) => ({ name: 'guide_step', ts: 0, uid, props: { id, result, waitS } });

describe('the guide funnel in the report', () => {
  it('lists every guide id once', () => {
    expect([...GUIDE_ORDER].sort()).toEqual([...GUIDE_CHAPTERS.flat(), ...GUIDE_LATER, ...GUIDE_ONCE].sort());
  });

  it("counts each player's first report of a step by result, in the order players meet them", () => {
    const rows = guideRows([
      step('a', 'login', 'done', 4),
      step('a', 'login', 'skipped'),
      step('b', 'login', 'other', 2),
      step('c', 'login', 'none'),
      step('a', 'gift', 'done', 1),
      { name: 'run_end', ts: 0, uid: 'a', props: {} },
    ]);
    expect(rows).toEqual([
      { id: 'gift', players: 1, done: 1, skipped: 0, other: 0, none: 0, medianWait: 1 },
      { id: 'login', players: 3, done: 1, skipped: 0, other: 1, none: 1, medianWait: 4 },
    ]);
    const lines: string[] = [];
    printGuide(rows, (l) => lines.push(l));
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatch(/^login\s+3\s+1\s+0\s+1\s+1\s+4s$/);
    printGuide([], (l) => lines.push(l));
    expect(lines).toHaveLength(4);
  });
});
