// scripts/eventRows.mjs: the report scripts read only rows they can use, with control characters
// blanked, whatever else is in the collector's file.

import { describe, expect, it } from 'vitest';
import { clean, parseEvents, usable } from '../../scripts/eventRows.mjs';
import { feedbackLines } from '../../scripts/playtestMetrics.mjs';

const ROW = { name: 'feedback', uid: 'u1', sid: 's1', ts: 1_760_000_000_000, build: 'b1', platform: 'web', src: 'reddit', props: { rating: 4, text: 'fun' } };

describe('eventRows', () => {
  it('keeps good rows and counts the rest as skipped', () => {
    const lines = [
      JSON.stringify(ROW),
      '{"name":"run_end","ts":5',
      'null',
      '[1]',
      JSON.stringify({ ...ROW, name: 7 }),
      JSON.stringify({ ...ROW, ts: '2026-10-22' }),
      JSON.stringify({ ...ROW, ts: null }),
      JSON.stringify({ ...ROW, ts: 9e15 }),
      JSON.stringify({ ...ROW, src: { $gt: '' } }),
      JSON.stringify({ ...ROW, uid: 5 }),
      JSON.stringify({ ...ROW, props: 'x' }),
      '',
      JSON.stringify({ name: 'beacon', step: 'open_desktop', ts: 1 }),
    ];
    const { events, skipped } = parseEvents(lines.join('\n'));
    expect(events.map((e) => e.name)).toEqual(['feedback', 'beacon']);
    expect(skipped).toBe(10);
  });

  it('blanks control characters in every string, keys included', () => {
    const row = { ...ROW, src: 'a\u001b[2Jb', props: { text: 'x\r\ny\u2028', ['k\u0007']: ['\u009b31m'] } };
    expect(clean(row)).toEqual({ ...ROW, src: 'a [2Jb', props: { text: 'x  y ', 'k ': [' 31m'] } });
    expect(parseEvents(JSON.stringify(row)).events[0].src).toBe('a [2Jb');
    expect(usable(clean(row))).toBe(true);
  });

  it('feedbackLines skips a row whose time Date cannot show, and a src that is not a string', () => {
    const rows = [ROW, { ...ROW, ts: Number.NaN }, { ...ROW, ts: 1e300 }, { ...ROW, src: 5, ts: ROW.ts - 60_000 }];
    const out = feedbackLines(rows as Parameters<typeof feedbackLines>[0]);
    expect(out).toHaveLength(2);
    expect(out[1]).toContain('unknown');
  });
});
