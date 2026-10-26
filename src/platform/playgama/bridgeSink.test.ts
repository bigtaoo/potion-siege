import { describe, expect, it } from 'vitest';
import type { TrackedEvent } from '../../analytics/analytics';
import { BridgeEvents, BridgeSink, deviceFields } from './bridgeSink';

describe('BridgeEvents', () => {
  it('makes the tutorial a funnel of steps, then completed', () => {
    const m = new BridgeEvents();
    expect(m.map('tutorial_step', { step: 'merge', doneT: 9 })).toEqual(['tutorial_step', { step_id: 'merge', step_index: 2, seconds: 9 }]);
    expect(m.map('tutorial_end', { step: 'done', skipped: false })).toEqual(['tutorial_completed', { step_id: 'done', step_index: 5, seconds: 0, skipped: false, at_step: 'done' }]);
  });

  it('makes runs a progression funnel by stage, carrying the stage to the run end', () => {
    const m = new BridgeEvents();
    expect(m.map('run_start', { run: 3, cause: 'next', stage: 4 })).toEqual(['progression_started', { step_id: 'stage_4', step_index: 4, mode: 'story', run: 3, cause: 'next' }]);
    const end = { run: 3, result: 'won', wave: 10, secs: 140, kills: 300, merges: 12, maxStar: 3, wall: 82 };
    expect(m.map('run_end', end)).toEqual(['progression_completed', { step_id: 'stage_4', step_index: 4, mode: 'story', run: 3, wave: 10, duration_sec: 140, kills: 300, merges: 12, max_star: 3, wall_pct: 82 }]);
    expect(m.map('run_end', { ...end, result: 'lost' })?.[1]).toMatchObject({ reason: 'wall_fell' });
    expect(m.map('run_quit', { ...end, giveUp: true })).toMatchObject(['progression_failed', { step_id: 'stage_4', reason: 'gave_up' }]);
    expect(m.map('run_quit', end)?.[1]).toMatchObject({ reason: 'left' });
  });

  it('names endless and challenge runs by their mode', () => {
    const m = new BridgeEvents();
    expect(m.map('run_start', { cause: 'endless', stage: 1 })?.[1]).toMatchObject({ step_id: 'endless', mode: 'endless' });
    expect(m.map('run_start', { cause: 'challenge', stage: 7 })?.[1]).toMatchObject({ step_id: 'challenge', step_index: 7, mode: 'challenge' });
  });

  it('leaves out every other event', () => {
    expect(new BridgeEvents().map('session_start', {})).toBeNull();
  });
});

describe('deviceFields', () => {
  it('tells phones, an iPad posing as a Mac and desktops apart', () => {
    expect(deviceFields('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 5, 'mobile')).toEqual({ device: 'ios', form: 'mobile', touch: true });
    expect(deviceFields('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5, 'tablet')).toEqual({ device: 'ios', form: 'tablet', touch: true });
    expect(deviceFields('Mozilla/5.0 (Linux; Android 14)', 5, null)).toEqual({ device: 'android', form: 'unknown', touch: true });
    expect(deviceFields('Mozilla/5.0 (Windows NT 10.0)', 0, 'desktop')).toEqual({ device: 'desktop', form: 'desktop', touch: false });
  });
});

describe('BridgeSink', () => {
  it('sends the mapped events with the device, session and build', () => {
    const tracked: [string, unknown][] = [];
    const sink = new BridgeSink({ track: (e, d) => void tracked.push([e, d]) }, { device: 'desktop', form: 'desktop', touch: false }, '0.1+abc');
    const ev = (name: string, props: TrackedEvent['props']): TrackedEvent => ({ name, props, uid: '', sid: 's', ts: 0, day: 0, session: 1, build: 'b', platform: 'playgama', src: 'playgama' });
    sink.send([ev('session_start', {}), ev('run_start', { run: 1, cause: 'first', stage: 1 })]);
    expect(tracked).toEqual([['progression_started', { step_id: 'stage_1', step_index: 1, mode: 'story', run: 1, cause: 'first', device: 'desktop', form: 'desktop', touch: false, session: 1, day: 0, build_version: '0.1+abc' }]]);
    expect(sink.beforeConsent).toBe(true);
  });
});
