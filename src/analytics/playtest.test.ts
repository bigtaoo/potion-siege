import { describe, expect, it } from 'vitest';
import { feedbackLines, playtestRows, printPlaytest } from '../../scripts/playtestMetrics.mjs';

const DAY = 86_400_000;
const T0 = 100 * DAY;

type Ev = Parameters<typeof playtestRows>[0][number];

/** Events of one session, `at` in seconds after `start`. */
function session(uid: string, sid: string, n: number, start: number, src: string | undefined, list: [number, string, Record<string, unknown>][]): Ev[] {
  return list.map(([at, name, props]) => ({ name, uid, sid, session: n, day: Math.floor((start - T0) / DAY), ts: start + at * 1000, build: 'b1', ...(src ? { src } : {}), props }));
}

const beacon = (step: string, extra: Record<string, unknown>, ts = T0): Ev => ({ name: 'beacon', step, host: 'web', build: 'b1', ts, ...extra });

const events: Ev[] = [
  // A: reddit, desktop; wins run 1, quits run 2 on stage 2 wave 3, rates 4, back on day 1
  ...session('A', 'a1', 1, T0, 'reddit', [
    [0, 'session_start', { device: 'desktop', touch: false }],
    [1, 'run_start', { run: 1, stage: 1, cause: 'first' }],
    [2, 'wave_start', { run: 1, wave: 1 }],
    [80, 'tutorial_end', { step: 'done', skipped: false }],
    [91, 'run_end', { run: 1, result: 'won', wave: 10, secs: 90 }],
    [100, 'run_start', { run: 2, stage: 2, cause: 'next' }],
    [110, 'wave_start', { run: 2, wave: 3 }],
    [120, 'run_quit', { run: 2, result: 'quit', wave: 3, secs: 20 }],
    [121, 'feedback', { rating: 4, text: 'fun', run: 3 }],
    [200, 'session_end', { secs: 300 }],
  ]),
  ...session('A', 'a2', 2, T0 + DAY, 'reddit', [[0, 'session_start', { device: 'desktop' }]]),
  // B: reddit, touch; the tab dies 40 s into run 1 with no end sent
  ...session('B', 'b1', 1, T0, 'reddit', [
    [0, 'session_start', { device: 'touch', touch: true }],
    [1, 'run_start', { run: 1, stage: 1, cause: 'first' }],
    [41, 'wave_start', { run: 1, wave: 2 }],
    [41, 'feedback_skip', { how: 'closed', run: 3 }],
  ]),
  // C: a build from before sources (no src, no device field), loses run 1 after 61 s
  ...session('C', 'c1', 1, T0, undefined, [
    [0, 'session_start', { touch: false }],
    [1, 'run_start', { run: 1, stage: 1, cause: 'first' }],
    [62, 'run_end', { run: 1, result: 'lost', wave: 6, secs: 61 }],
  ]),
  // D: a returning player, not new
  ...session('D', 'd5', 5, T0, 'reddit', [[0, 'session_start', { device: 'desktop' }], [10, 'run_start', { run: 9, stage: 7, cause: 'again' }]]),
  beacon('open_desktop', { new: true, src: 'reddit' }),
  beacon('open_desktop', { new: true, src: 'reddit' }),
  beacon('loaded_desktop', { new: true, src: 'reddit', ms: 900 }),
  beacon('open_desktop', { new: false, src: 'reddit' }),
  beacon('open_touch', { new: true, src: 'reddit' }),
  beacon('open_desktop', {}, T0 + 3 * DAY), // an old beacon: no new, no src
];

describe('playtestRows', () => {
  const rows = playtestRows(events);
  const row = (src: string, device: string) => rows.find((r) => r.src === src && r.device === device)!;

  it('scores reddit desktop', () => {
    expect(row('reddit', 'desktop')).toMatchObject({
      build: 'b1',
      players: 1,
      opens: 2,
      loaded: 1,
      converted: 1,
      conversion: 0.5,
      playMinutes: 5,
      d1: { back: 1, eligible: 1 },
      tutorial: 1,
      run1End: 1,
      run2Start: 1,
      run3Start: 0,
      stageMedian: 2,
      stageMax: 2,
      runs: 2,
      quits: 1,
      quitAt: [['s2w3', 1]],
      feedback: { n: 1, mean: 4, skipped: 0 },
    });
  });

  it('counts a run whose end never came as quit, by its last wave, and its battle time up to there', () => {
    const r = row('reddit', 'touch');
    expect(r).toMatchObject({ players: 1, opens: 1, converted: 0, conversion: 0, quits: 1, quitAt: [['s1w2', 1]], feedback: { n: 0, skipped: 1 } });
    expect(r.playMinutes).toBeCloseTo(41 / 60);
  });

  it('reads old events as unknown and desktop, and leaves returning players out', () => {
    expect(row('unknown', 'desktop')).toMatchObject({ players: 1, opens: 1, converted: 1, conversion: 1 });
    expect(row('(all)', 'desktop')).toMatchObject({ players: 2, opens: 3, converted: 2 });
    expect(rows.reduce((n, r) => n + (r.src === '(all)' ? r.players : 0), 0)).toBe(3);
  });

  it('prints a table and the feedback', () => {
    const lines: string[] = [];
    printPlaytest(rows, (l) => lines.push(l));
    expect(lines.join('\n')).toMatch(/reddit\s+desktop\s+1\s+2\s+1\s+50%\s+1\/2/);
    expect(lines.join('\n')).toContain('quit at s2w3 x1');
    expect(lines.join('\n')).toMatch(/reddit\s+touch\s.*- skip 1/);
    // more converted players than open beacons: flagged, not counted as meeting the bar
    const short = rows.map((r) => (r.src === 'reddit' && r.device === 'desktop' ? { ...r, converted: 2, opens: 1, conversion: 2 } : r));
    const flagged: string[] = [];
    printPlaytest(short, (l) => flagged.push(l));
    expect(flagged.join('\n')).toMatch(/reddit\s+desktop.*200%!/);
    expect(feedbackLines(events)).toHaveLength(1);
    expect(feedbackLines(events)[0]).toContain('4/5  reddit');
  });
});
