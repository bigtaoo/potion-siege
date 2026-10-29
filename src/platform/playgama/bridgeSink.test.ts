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
    m.map('run_start', { run: 4, cause: 'next', stage: 4 });
    expect(m.map('run_quit', { ...end, giveUp: true })).toMatchObject(['progression_failed', { step_id: 'stage_4', reason: 'gave_up' }]);
  });

  it('says when a player left mid-run in real seconds, battle seconds beside them, once per run', () => {
    const m = new BridgeEvents();
    m.map('run_start', { run: 1, cause: 'first', stage: 1 }, 10_000);
    // the tutorial holds the battle at 2 s while 41 real seconds go by
    const quit = { run: 1, result: 'quit', wave: 1, secs: 2, kills: 0, merges: 0, maxStar: 1, wall: 100 };
    expect(m.map('run_hidden', quit, 51_400)).toEqual([
      'progression_failed',
      { step_id: 'stage_1', step_index: 1, mode: 'story', run: 1, wave: 1, duration_sec: 2, kills: 0, merges: 0, max_star: 1, wall_pct: 100, reason: 'left', via: 'hidden', wall_sec: 41, battle_sec: 2 },
    ]);
    // the pagehide right after the hide sends nothing more
    expect(m.map('run_quit', quit, 52_000)).toBeNull();
  });

  it('takes pagehide alone when the page never reported hidden, and nothing once the run ended', () => {
    const m = new BridgeEvents();
    m.map('run_start', { run: 2, cause: 'again', stage: 1 }, 0);
    expect(m.map('run_quit', { run: 2, secs: 30 }, 45_000)?.[1]).toMatchObject({ reason: 'left', via: 'pagehide', wall_sec: 45, battle_sec: 30 });
    m.map('run_start', { run: 3, cause: 'again', stage: 1 }, 50_000);
    m.map('run_end', { run: 3, result: 'lost' }, 90_000);
    expect(m.map('run_hidden', { run: 3 }, 95_000)).toBeNull();
  });

  it('still ends a run the player came back to after a tab switch, saying they came back', () => {
    const m = new BridgeEvents();
    m.map('run_start', { run: 1, cause: 'first', stage: 1 }, 0);
    m.map('run_hidden', { run: 1, secs: 20 }, 20_000);
    expect(m.map('run_end', { run: 1, result: 'won' }, 200_000)).toMatchObject(['progression_completed', { returned: true }]);
    m.map('run_start', { run: 2, cause: 'again', stage: 1 }, 210_000);
    expect(m.map('run_end', { run: 2, result: 'lost' }, 300_000)?.[1]).not.toHaveProperty('returned');
  });

  it('on a desktop counts only pagehide as left, so a tab switch is nothing', () => {
    const m = new BridgeEvents(false);
    m.map('run_start', { run: 4, cause: 'again', stage: 4 }, 0);
    expect(m.map('run_hidden', { run: 4, secs: 13 }, 15_000)).toBeNull();
    expect(m.map('run_end', { run: 4, result: 'won' }, 208_000)?.[1]).not.toHaveProperty('returned');
    m.map('run_start', { run: 5, cause: 'next', stage: 5 }, 220_000);
    m.map('run_hidden', { run: 5, secs: 5 }, 226_000);
    expect(m.map('run_quit', { run: 5, secs: 5 }, 227_000)?.[1]).toMatchObject({ reason: 'left', via: 'pagehide', wall_sec: 7 });
  });

  it('gives the first input and tutorial steps real seconds since the run started', () => {
    const m = new BridgeEvents();
    expect(m.map('first_input', { t: 3 }, 3_000)).toEqual(['first_input', { load_sec: 3 }]);
    m.map('run_start', { run: 1, cause: 'first', stage: 1 }, 4_000);
    expect(m.map('first_input', { t: 9 }, 9_200)).toEqual(['first_input', { load_sec: 9, wall_sec: 5 }]);
    expect(m.map('tutorial_step', { step: 'summon', doneT: 2 }, 30_000)).toEqual(['tutorial_step', { step_id: 'summon', step_index: 1, seconds: 2, wall_sec: 26 }]);
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

describe('BridgeEvents with missing or odd props', () => {
  it('counts an unknown tutorial step as done, and fills missing numbers with 0', () => {
    const m = new BridgeEvents();
    expect(m.map('tutorial_step', { step: 'dance' })).toEqual(['tutorial_step', { step_id: 'done', step_index: 5, seconds: 0 }]);
    expect(m.map('tutorial_end', { skipped: true })?.[1]).toMatchObject({ skipped: true, at_step: 'done' });
    expect(m.map('first_input', {})).toEqual(['first_input', { load_sec: 0 }]);
  });

  it('reads a run with no cause or numbers as stage 1 of the story', () => {
    const m = new BridgeEvents();
    expect(m.map('run_start', {}, 0)).toEqual(['progression_started', { step_id: 'stage_1', step_index: 1, mode: 'story', run: 0, cause: '' }]);
    expect(m.map('run_hidden', {}, 1_000)?.[1]).toEqual({
      step_id: 'stage_1',
      step_index: 1,
      mode: 'story',
      run: 0,
      wave: 0,
      duration_sec: 0,
      kills: 0,
      merges: 0,
      max_star: 0,
      wall_pct: 0,
      reason: 'left',
      via: 'hidden',
      wall_sec: 1,
      battle_sec: 0,
    });
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

  it('counts a hidden page as left on a phone, not on a desktop', () => {
    const ev = (name: string, props: TrackedEvent['props']): TrackedEvent => ({ name, props, uid: '', sid: 's', ts: 0, day: 0, session: 1, build: 'b', platform: 'playgama', src: 'playgama' });
    const sent = (device: string) => {
      const tracked: string[] = [];
      new BridgeSink({ track: (e) => void tracked.push(e) }, { device, form: 'mobile', touch: true }, 'b').send([ev('run_start', { stage: 1 }), ev('run_hidden', {})]);
      return tracked;
    };
    expect(sent('android')).toEqual(['progression_started', 'progression_failed']);
    expect(sent('desktop')).toEqual(['progression_started']);
  });
});
