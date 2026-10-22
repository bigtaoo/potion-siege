import { describe, expect, it } from 'vitest';
import { compareBuilds, newestBuilds, printCompare } from '../../scripts/buildCompare.mjs';

const H = 3_600_000;
const T0 = 1000 * H;

/** One session of a new player (or session `n`), `at` in seconds after `start`. */
function session(uid: string, build: string, start: number, list: [number, string, Record<string, unknown>][], n = 1, platform = 'crazygames') {
  return list.map(([at, name, props]) => ({ name, uid, sid: `${uid}${n}`, session: n, build, platform, ts: start + at * 1000, props }));
}

const events = [
  // old build, out since T0: A converts and comes back 30 h later (past the window) for a second run
  ...session('A', 'old', T0, [
    [0, 'session_start', { device: 'desktop' }],
    [1, 'run_start', { run: 1, stage: 1 }],
    [80, 'run_end', { run: 1, result: 'won', secs: 79 }],
    [120, 'session_end', { secs: 120, vis: 120 }],
  ]),
  ...session('A', 'old', T0 + 30 * H, [[0, 'session_start', { device: 'desktop' }], [1, 'run_start', { run: 2, stage: 2 }]], 2),
  // new build, out since T0 + 48 h, newest event 2 h later: B's page dies mid-run at wave 4
  ...session('B', 'new', T0 + 48 * H, [
    [0, 'session_start', { device: 'touch' }],
    [1, 'run_start', { run: 1, stage: 1 }],
    [30, 'wave_start', { run: 1, wave: 3 }],
    [61, 'alive', { vis: 60, place: 'run', stage: 1, wave: 4 }],
    [62, 'anomaly', { kind: 'stall' }],
  ]),
  ...session('C', 'new', T0 + 50 * H, [[0, 'session_start', { device: 'desktop' }]]),
  // an older build and another host stay out
  ...session('D', 'older', T0 - 99 * H, [[0, 'session_start', {}]]),
  ...session('E', 'web1', T0 + 49 * H, [[0, 'session_start', {}]], 1, 'web'),
];

describe('compareBuilds', () => {
  it('picks the host’s two newest builds by their first new player', () => {
    expect(newestBuilds(events, 'crazygames').map((b) => b.build)).toEqual(['new', 'old']);
  });

  it('reads both builds over the age the newer one has reached', () => {
    const cmp = compareBuilds(events, 'crazygames');
    expect(cmp.hours).toBeCloseTo(2, 1);
    const row = (build: string, device: string) => cmp.rows.find((r) => r.build === build && r.device === device);
    // A's day-2 return is past the 2 h window
    expect(row('old', 'desktop')).toMatchObject({ players: 1, launches: 1, converted: 1, playMinutes: 2, run2: 0, noEnd: 0 });
    expect(row('new', 'touch')).toMatchObject({ players: 1, converted: 0, noEnd: 1, noEndAt: ['s1w4'], stalls: 1, playMinutes: 61 / 60 });
    expect(row('new', 'desktop')).toMatchObject({ players: 1, launches: 1 });
  });

  it('takes a wider window when asked, and prints a table', () => {
    const cmp = compareBuilds(events, 'crazygames', 48);
    expect(cmp.rows.find((r) => r.build === 'old')).toMatchObject({ launches: 2, run2: 1, noEnd: 1 });
    const lines: string[] = [];
    printCompare('crazygames', cmp, (l) => lines.push(l));
    expect(lines.join('\n')).toMatch(/new\s+touch\s+1\s+1\s+0%\s+1\.0m\s+0%\s+1\s+1\.0\s+0\.0\s+s1w4/);
  });

  it('says so when the host has only one build', () => {
    const lines: string[] = [];
    printCompare('web', compareBuilds(events, 'web'), (l) => lines.push(l));
    expect(lines[lines.length - 1]).toContain('found 1');
  });
});
