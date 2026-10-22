// What scripts/collector.mjs keeps of a posted event (cleanEvent), and that it keeps every event
// the game sends: the names are read from the game's own track()/first() calls, so a new event
// with no place in the collector's list fails here instead of vanishing on the server.

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('node:http', () => ({ createServer: () => ({ listen: () => {} }) }));
vi.mock('node:fs', () => ({
  mkdirSync: () => {},
  appendFileSync: () => {},
  readdirSync: () => [],
  unlinkSync: () => {},
  statSync: () => ({ size: 0 }),
}));

let cleanEvent: (e: unknown, received: number) => string | null;
beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ({ cleanEvent } = await import('../../scripts/collector.mjs'));
});

const NOW = 1_760_000_000_000;
const EVENT = { name: 'run_end', uid: 'a1b2c3', sid: 'd4e5f6', ts: NOW - 5, day: 2, session: 7, build: '1.0.13+9cd15d9', platform: 'ios', src: 'reddit.com' };
const kept = (e: unknown) => {
  const line = cleanEvent(e, NOW);
  return line === null ? null : (JSON.parse(line) as Record<string, unknown>);
};

describe('collector event fields', () => {
  it('keeps TrackedEvent as the game sends it, stamped with the time received', () => {
    const props = { run: 3, result: 'won', bonus: true, none: null, kinds: ['fire', 'ice'], hp: [1, 2.5] };
    expect(kept({ ...EVENT, props })).toEqual({ ...EVENT, props, received: NOW });
  });

  it('drops keys TrackedEvent does not have', () => {
    expect(kept({ ...EVENT, ip: '1.2.3.4', email: 'a@b.c', __proto__x: 1 })).toEqual({ ...EVENT, received: NOW });
  });

  it('drops an event with an unknown name or a field of the wrong type', () => {
    for (const bad of [
      { name: 'evil', uid: 'u' },
      { name: 'first_star10', uid: 'u' },
      { name: 'run_end', uid: 'u u' },
      { name: 'run_end', uid: 'u'.repeat(65) },
      { name: 'run_end', uid: 'u', sid: 5 },
      { name: 'run_end', uid: 'u', ts: 'now' },
      { name: 'run_end', uid: 'u', ts: null },
      { name: 'run_end', uid: 'u', day: 1.5 },
      { name: 'run_end', uid: 'u', session: '1' },
      { name: 'run_end', uid: 'u', build: 'b'.repeat(41) },
      { name: 'run_end', uid: 'u', platform: 'web\n' },
      { name: 'run_end', uid: 'u', src: ['x'] },
      { name: 'run_end', uid: 'u', props: [] },
      { name: 'run_end', uid: 'u', props: 'x' },
      [{ name: 'run_end', uid: 'u' }],
    ]) {
      expect(kept(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('keeps only props of the shapes Props allows', () => {
    const props = { ok: 1, nested: { a: 1 }, mixed: [1, 'a'], deep: [[1]], 'bad key': 1, $x: 1, nan: Number.NaN, long: new Array(51).fill(1) };
    expect(kept({ ...EVENT, props })?.props).toEqual({ ok: 1 });
  });

  it('cuts strings at 200 characters and blanks control characters', () => {
    const props = { text: `${'a'.repeat(198)}\n ${'b'.repeat(50)}`, tags: ['x\u0000y'] };
    expect(kept({ ...EVENT, props })?.props).toEqual({ text: `${'a'.repeat(198)}  `, tags: ['x y'] });
  });

  it('keeps at most 64 props and drops an event still over 4 KB', () => {
    const many = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(kept({ ...EVENT, props: many })?.props ?? {})).toHaveLength(64);
    const big = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 'x'.repeat(200)]));
    expect(kept({ ...EVENT, props: big })).toBeNull();
  });
});

const sources = import.meta.glob<string>('../**/*.ts', { query: '?raw', import: 'default', eager: true });
const game = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));

describe('collector event names', () => {
  it('accepts every name the game tracks', () => {
    const names = new Set<string>();
    for (const [, text] of game) {
      for (const m of text.matchAll(/\.(?:track|first)\(\s*'([a-z0-9_]+)'/g)) names.add(m[1]);
      // a ternary as the first argument
      for (const m of text.matchAll(/\.(?:track|first)\((?:[^,?;\n'(]|'[^']*')*\?\s*'([a-z0-9_]+)'\s*:\s*'([a-z0-9_]+)'/g)) {
        names.add(m[1]);
        names.add(m[2]);
      }
    }
    // the names built at run time: first_star<n>, first_<OfferReason>, the feedback sheet's two
    for (const n of ['first_star3', 'first_star9', 'first_upgrade', 'first_ultimate', 'feedback', 'feedback_skip']) names.add(n);
    expect(names.size).toBeGreaterThan(40);
    expect(names).toContain('hint_upgrade_tab');
    const dropped = [...names].filter((name) => kept({ name, uid: 'u' }) === null);
    expect(dropped).toEqual([]);
  });

  it('knows each name built at run time by its source', () => {
    const all = game.map(([, text]) => text).join('\n');
    expect(all).toContain('first(`first_star${');
    expect(all).toContain('first(`first_${ev.reason}`');
    expect(all).toMatch(/type OfferReason = 'upgrade' \| 'ultimate';/);
    expect(all).toMatch(/FeedbackSend = \(name: 'feedback' \| 'feedback_skip'/);
  });
});
