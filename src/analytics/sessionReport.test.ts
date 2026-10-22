import { describe, expect, it } from 'vitest';
import { sessionSecs, sessionSpans } from '../../scripts/playtestMetrics.mjs';
import { printSessions, sessionStats } from '../../scripts/sessionReport.mjs';

const T0 = 1_000_000;

/** Events of one session, `at` in seconds after T0. */
const session = (sid: string, list: [number, string, Record<string, unknown>][]) => list.map(([at, name, props]) => ({ name, uid: sid.toUpperCase(), sid, ts: T0 + at * 1000, props }));

const events = [
  // a: on screen 3 of its 30 minutes open (the rest in another tab), closed normally
  ...session('a', [
    [0, 'session_start', {}],
    [60, 'alive', { vis: 60, place: 'home' }],
    [1500, 'alive', { vis: 120, place: 'run', stage: 2, wave: 4 }],
    [1560, 'alive', { vis: 180, place: 'run', stage: 2, wave: 6 }],
    [1800, 'session_end', { secs: 1800, vis: 200 }],
  ]),
  // b: killed 25 s after its second beat, mid-run, with no session_end
  ...session('b', [
    [0, 'session_start', {}],
    [60, 'alive', { vis: 60, place: 'run', stage: 1, wave: 2 }],
    [120, 'alive', { vis: 120, place: 'run', stage: 1, wave: 5 }],
    [145, 'wave_start', { wave: 6 }],
  ]),
  // c: restored from the back/forward cache and left twice: one session, the larger total
  ...session('c', [
    [0, 'session_start', {}],
    [30, 'session_end', { secs: 30, vis: 30 }],
    [100, 'session_end', { secs: 100, vis: 70 }],
  ]),
  // d: a build from before the beat
  ...session('d', [
    [0, 'session_start', {}],
    [90, 'session_end', { secs: 95 }],
  ]),
];

describe('playtime from the alive beat', () => {
  const spans = sessionSpans(events);

  it('counts the time on screen, not the time the page was open', () => {
    expect(sessionSecs(spans.get('a')!)).toBe(200);
  });

  it('adds what a killed page did after its last beat, at most a minute', () => {
    expect(spans.get('b')).toMatchObject({ vis: 120, ended: false });
    expect(sessionSecs(spans.get('b')!)).toBe(145);
    expect(sessionSecs({ ...spans.get('b')!, last: spans.get('b')!.last + 3_600_000 })).toBe(180);
  });

  it('takes the larger total of a session left twice, and the wall clock before the beat', () => {
    expect(sessionSecs(spans.get('c')!)).toBe(70);
    expect(sessionSecs(spans.get('d')!)).toBe(95);
  });
});

describe('sessionStats', () => {
  const st = sessionStats(events);

  it('counts each session once and splits off the ones whose page died', () => {
    expect(st).toMatchObject({ ended: 3, endedMedian: 100, beating: 3, visMedian: 145, died: [['run s1w5', 1]] });
    expect(st.visMean).toBeCloseTo((200 + 145 + 70) / 3 / 60);
  });

  it('prints the block, and only the wall clock for data from before the beat', () => {
    const lines: string[] = [];
    printSessions(st, (l) => lines.push(l));
    expect(lines.join('\n')).toContain('median length 100s over 3 ended sessions');
    expect(lines.join('\n')).toContain('on screen (alive beat): median 145s, mean 2.3 min over 3 sessions');
    expect(lines.join('\n')).toContain('page died with no session_end: 1, last beat at run s1w5 x1');
    const old: string[] = [];
    printSessions(sessionStats(session('d', [[90, 'session_end', { secs: 95 }]])), (l) => old.push(l));
    expect(old).toHaveLength(1);
  });
});
