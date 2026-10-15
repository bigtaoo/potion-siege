import { describe, expect, it } from 'vitest';
import { SafeStore } from '../platform/types';
import { Battle } from '../sim/battle';
import { Analytics, type Clock } from './analytics';
import { RunTracker } from './runTracker';
import { MemorySink } from './sinks';

const DAY = 86_400_000;

function clockAt(ms: { now: number }): Clock {
  return { now: () => ms.now, offsetMinutes: () => 0 };
}

describe('Analytics', () => {
  it('keeps the player id and counts days and sessions across loads', () => {
    const store = new SafeStore(null);
    const time = { now: 10 * DAY + 3_600_000 };
    const sink = new MemorySink();
    const first = new Analytics(store, [sink], '1', 'web', clockAt(time));
    first.track('session_start');
    expect(first.day).toBe(0);
    expect(first.sessions).toBe(1);

    time.now += DAY;
    const second = new Analytics(store, [sink], '1', 'web', clockAt(time));
    second.track('session_start');
    expect(sink.events[1]).toMatchObject({ day: 1, session: 2, uid: sink.events[0].uid });
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('reports a first-time milestone once per player', () => {
    const store = new SafeStore(null);
    const sink = new MemorySink();
    const a = new Analytics(store, [sink], '1', 'web');
    a.first('first_merge');
    a.first('first_merge');
    new Analytics(store, [sink], '1', 'web').first('first_merge');
    expect(sink.events.filter((e) => e.name === 'first_merge')).toHaveLength(1);
  });

  it('survives a broken sink and corrupt storage', () => {
    const store = new SafeStore(null);
    store.setItem('mb.player', '{not json');
    const a = new Analytics(store, [{ send: () => { throw new Error('boom'); } }], '1', 'web');
    expect(() => a.track('x')).not.toThrow();
  });
});

describe('RunTracker', () => {
  it('summarises a run and reports a quit only when the run is unfinished', () => {
    const sink = new MemorySink();
    const a = new Analytics(new SafeStore(null), [sink], '1', 'web');
    const b = new Battle(7);
    const run = new RunTracker(a, b, 1, 'first');
    b.summon();
    run.onEvents(b.drain());
    run.close('pagehide');
    run.close('pagehide');
    const names = sink.events.map((e) => e.name);
    expect(names).toEqual(['run_start', 'wave_start', 'first_summon', 'run_quit']);
    expect(sink.events[3].props).toMatchObject({ run: 1, result: 'quit', summons: 1 });
  });
});
