import { describe, expect, it } from 'vitest';
import { BENCHMARKS, scoreDay, scoreRange } from '../../scripts/cgBenchmarks.mjs';
import { dailyRows, dayOf, printDaily } from '../../scripts/dailyScorecard.mjs';

const DAY = 86_400_000;
const D0 = Date.parse('2026-11-02T00:00:00Z');
const m = (min: number, sec = 0) => min + sec / 60;

describe('cgBenchmarks', () => {
  const desk = BENCHMARKS.action.desktop;

  it('scores between known points as a range, and exactly where the points pin it', () => {
    expect(scoreRange(desk.conversion, 0.55)).toEqual({ lo: 2, hi: 2 });
    expect(scoreRange(desk.conversion, 0.6308)).toEqual({ lo: 3, hi: 5 });
    expect(scoreRange(desk.conversion, 0.5)).toEqual({ lo: 0, hi: 1 });
    expect(scoreRange(desk.playtime, m(12, 30))).toEqual({ lo: 5, hi: 5 });
    expect(scoreRange(desk.playtime, m(9))).toEqual({ lo: 4, hi: 4 });
    expect(scoreRange(desk.conversion, null)).toBeNull();
    expect(scoreRange([], 0.4)).toEqual({ lo: 0, hi: 5 });
    // Strategy: only Nivara's 27.6% mobile conversion -> 2 is known
    expect(scoreRange(BENCHMARKS.strategy.mobile.conversion, 0.3)).toEqual({ lo: 2, hi: 5 });
    expect(scoreRange(BENCHMARKS.strategy.mobile.conversion, 0.2)).toEqual({ lo: 0, hi: 2 });
  });

  it("gives Holy Kicker's final window the 8/15 per platform the portal gave it", () => {
    const desktop = scoreDay({ conversion: 0.5502, playtime: m(8, 56), d1: 0.0262 }, 'desktop', 'action');
    expect(desktop).toMatchObject({ conversion: { lo: 2, hi: 2 }, playtime: { lo: 4, hi: 4 }, d1: { lo: 2, hi: 2 }, total: { lo: 8, hi: 8 }, pass: false });
    const mobile = scoreDay({ conversion: 0.219, playtime: m(8, 43), d1: 0.0476 }, 'touch', 'action');
    expect(mobile).toMatchObject({ total: { lo: 8, hi: 8 }, pass: false });
    // the 10-16 day alone: desktop 59.4% and 12m24 would have made the bar
    expect(scoreDay({ conversion: 0.594, playtime: m(12, 24), d1: 0.0262 }, 'desktop', 'action')).toMatchObject({ total: { lo: 9, hi: 9 }, pass: true });
  });

  it('counts a metric not measured yet as anything from 0 to 5', () => {
    expect(scoreDay({ conversion: 0.55, playtime: m(9), d1: null }, 'desktop', 'action')).toMatchObject({ d1: null, total: { lo: 6, hi: 11 }, pass: null });
  });
});

describe('dailyRows', () => {
  type Ev = Parameters<typeof dailyRows>[0][number];
  let n = 0;
  /** A CG player's session starting at `ts` (device time) with one run of `battle` seconds. */
  const session = (uid: string, ts: number, battle: number, o: { device?: string; session?: number; day?: number; platform?: string; src?: string; received?: number; build?: string } = {}): Ev[] => {
    const sid = `s${n++}`;
    const base = { uid, sid, session: o.session ?? 1, day: o.day ?? 0, build: o.build ?? 'b1', platform: o.platform ?? 'crazygames', src: o.src ?? 'crazygames', received: o.received ?? ts + 5_000 };
    return [
      { ...base, name: 'session_start', ts, props: { device: o.device ?? 'desktop' } },
      { ...base, name: 'run_start', ts: ts + 1_000, props: { run: 1, stage: 1, cause: 'first' } },
      { ...base, name: 'run_end', ts: ts + 1_000 + battle * 1000, props: { run: 1, result: 'lost', wave: 4, secs: battle } },
      { ...base, name: 'session_end', ts: ts + 2_000 + battle * 1000, props: { secs: battle + 60 } },
    ];
  };
  const open = (device: string, ts: number, host = 'crazygames', src = 'crazygames'): Ev => ({ name: 'beacon', step: `open_${device}`, host, build: 'b1', ts, received: ts, new: true, src });

  const events: Ev[] = [
    // day 0: three desktop opens, two sessions; one starts a second before midnight and is sent
    // after it (the collector's `received` is day 1), its run carries on past midnight
    open('desktop', D0 + 1_000),
    open('desktop', D0 + 2_000),
    open('desktop', D0 + DAY - 30_000),
    ...session('A', D0 + 1_000, 120),
    ...session('B', D0 + DAY - 1_000, 90, { received: D0 + DAY + 60_000 }),
    // A comes back on day 1 (their calendar day 1)
    ...session('A', D0 + DAY + 3_600_000, 30, { session: 2, day: 1 }),
    // day 0, touch: one open, a session under a minute
    open('touch', D0 + 5_000),
    ...session('C', D0 + 5_000, 40, { device: 'touch' }),
    // day 2: the newest data
    open('desktop', D0 + 2 * DAY + 1_000),
    ...session('D', D0 + 2 * DAY + 1_000, 200, { build: 'b2' }),
    // the web playtest: left out of the CG view, picked by --src
    open('desktop', D0 + 1_000, 'web', 'reddit'),
    ...session('R', D0 + 1_000, 70, { platform: 'web', src: 'reddit' }),
  ];
  const result = dailyRows(events, { host: 'crazygames' }, 'action');
  const day = (date: string, device = 'desktop') => result.days.find((r) => r.label === date && r.device === device)!;

  it('buckets sessions by the UTC day of the device clock, not the collector', () => {
    expect(dayOf(D0 + DAY - 1)).toBe('2026-11-02');
    expect(day('2026-11-02')).toMatchObject({ opens: 3, newPlayers: 2, plays: 2, converted: 2, noisy: true });
    expect(day('2026-11-02').conversion).toBeCloseTo(2 / 3);
    // A's install-day time: the session's own 180 s; B's 150 s; day 1 does not count
    expect(day('2026-11-02').playtime).toBeCloseTo((180 + 150) / 2 / 60);
    // day 1 has only A's return: a play, no opens, no new players
    expect(day('2026-11-03')).toMatchObject({ opens: 0, newPlayers: 0, plays: 1, converted: 0, conversion: null, playtime: null, d1: null });
    expect(day('2026-11-02', 'touch')).toMatchObject({ opens: 1, newPlayers: 1, converted: 0, conversion: 0 });
  });

  it("waits with D1 until every new player of the day is 2 days old, and marks the running day", () => {
    // newest data is D0 + 2 days + ~1 s: A (D0 + 1 s) is old enough, B (a second before day 1) not yet
    expect(day('2026-11-02')).toMatchObject({ d1: null, d1Waiting: 1 });
    expect(day('2026-11-04')).toMatchObject({ partial: true, builds: [{ build: 'b2', n: 1 }] });
    expect(result.newestDay).toBe('2026-11-04');
    const later = dailyRows([...events, open('desktop', D0 + 3 * DAY)], { host: 'crazygames' }, 'action');
    expect(later.days.find((r) => r.label === '2026-11-02' && r.device === 'desktop')).toMatchObject({ d1: 0.5, d1Back: 1, d1Eligible: 2 });
  });

  it('adds the last complete days as the window and leaves the running day out of it', () => {
    expect(result.window).toHaveLength(2);
    expect(result.window![0]).toMatchObject({ label: '10-28..11-03', device: 'desktop', opens: 3, newPlayers: 2, plays: 3, d1: 1, d1Eligible: 1 });
    expect(result.opens).toBe(5);
  });

  it('reads a playtest source the same way', () => {
    const reddit = dailyRows(events, { src: 'reddit' });
    expect(reddit.days).toHaveLength(1);
    expect(reddit.days[0]).toMatchObject({ label: '2026-11-02', device: 'desktop', opens: 1, newPlayers: 1, converted: 1, conversion: 1 });
  });

  it('prints a row per day and device with the score next to the bar', () => {
    const lines: string[] = [];
    printDaily(result, 'host crazygames', (l) => lines.push(l), 'action');
    const text = lines.join('\n');
    expect(text).toContain('passes at 9/15');
    expect(text).toMatch(/2026-11-02\s+desktop\s+3~\s+2\s+66\.7% \[3-5\] 2\/3/);
    expect(text).toMatch(/2026-11-04\*\s+desktop/);
    expect(text).toContain('wait (1)');
    expect(text).toContain('opens so far: 5');
  });
});
