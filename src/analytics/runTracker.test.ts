import { describe, expect, it } from 'vitest';
import { SafeStore } from '../platform/types';
import { Battle } from '../sim/battle';
import { SKILL_IDS } from '../sim/skills';
import { Analytics } from './analytics';
import { RunTracker } from './runTracker';
import { MemorySink } from './sinks';

/** A tracker on a fresh battle, with the run_start event already dropped from the sink. */
function setup(store = new SafeStore(null), run = 1) {
  const sink = new MemorySink();
  const a = new Analytics(store, [sink], '1', 'web');
  const b = new Battle(7);
  const tracker = new RunTracker(a, b, run, run === 1 ? 'first' : 'again');
  sink.events.length = 0;
  return { sink, a, b, tracker, store };
}

const named = (sink: MemorySink, name: string) => sink.events.filter((e) => e.name === name).map((e) => e.props);

describe('RunTracker onEvents', () => {
  it('reports onboarding firsts once, the player doing every one (the tutorial never acts)', () => {
    const { sink, b, tracker } = setup();
    b.wave = 2;
    tracker.onEvents([
      { type: 'summon', slot: 0 },
      { type: 'summon', slot: 1 },
      { type: 'merge', slot: 0, star: 2, kind: 'fire' },
      { type: 'offer', reason: 'upgrade' },
      { type: 'offer', reason: 'ultimate' },
    ]);

    expect(sink.events.map((e) => e.name)).toEqual(['first_summon', 'first_merge', 'first_upgrade', 'first_ultimate']);
    expect(sink.events[1].props).toMatchObject({ wave: 2 });
    expect(sink.events[2].props).toMatchObject({ wave: 2 });
    for (const e of sink.events) expect(e.props).not.toHaveProperty('by');
  });

  it('reports star 3+ firsts and counts merges and the best star in the summary', () => {
    const { sink, b, tracker } = setup();
    tracker.onEvents([
      { type: 'merge', slot: 0, star: 2, kind: 'fire' },
      { type: 'merge', slot: 1, star: 3, kind: 'ice' },
      { type: 'merge', slot: 2, star: 3, kind: 'wind' },
      { type: 'merge', slot: 0, star: 2, kind: 'arcane' },
      { type: 'wave', wave: 5, boss: true },
    ]);
    b.result = 'lost';
    tracker.onEnd();

    expect(named(sink, 'first_star3')).toEqual([expect.objectContaining({ run: 1 })]);
    expect(named(sink, 'wave_start')).toEqual([{ run: 1, wave: 5, boss: true, wall: 100 }]);
    expect(named(sink, 'run_end')[0]).toMatchObject({ merges: 4, maxStar: 3 });
  });

  it('reports skill picks with the offer and the summary keeps them in order', () => {
    const { sink, b, tracker } = setup();
    const [x, y, z] = SKILL_IDS;
    b.wave = 3;
    tracker.onSkillPick(x, [x, y]);
    tracker.onSkillPick(z, [z, y]);
    expect(named(sink, 'skill_pick')[0]).toMatchObject({ run: 1, id: x, offered: [x, y], wave: 3 });
    tracker.close('pagehide');
    expect(named(sink, 'run_quit')[0]).toMatchObject({ skills: [x, z] });
  });
});

describe('RunTracker ad events', () => {
  it('reports an offer and its result for each placement, at the current wave', () => {
    const { sink, b, tracker } = setup(undefined, 2);
    b.wave = 4;
    tracker.onReviveOffer();
    tracker.onReviveResult(true);
    tracker.onRerollOffer();
    tracker.onRerollResult(false);
    b.wave = 6;
    tracker.onDoubleOffer();
    tracker.onDoubleResult(true);

    expect(named(sink, 'ad_offer')).toEqual([
      { placement: 'revive', run: 2, wave: 4 },
      { placement: 'reroll', run: 2, wave: 4 },
      { placement: 'double', run: 2, wave: 6 },
    ]);
    expect(named(sink, 'ad_result')).toEqual([
      { placement: 'revive', ok: true, run: 2, wave: 4 },
      { placement: 'reroll', ok: false, run: 2, wave: 4 },
      { placement: 'double', ok: true, run: 2, wave: 6 },
    ]);
  });

  it('counts only revives that were watched in the run summary', () => {
    const { sink, b, tracker } = setup();
    b.result = 'lost';
    tracker.onEnd();
    tracker.onReviveOffer();
    tracker.onReviveResult(false);
    tracker.onReviveOffer();
    tracker.onReviveResult(true);
    tracker.onRerollResult(true);
    tracker.onDoubleResult(true);
    tracker.onEnd();

    const ends = named(sink, 'run_end');
    expect(ends).toHaveLength(2);
    expect(ends[0]).toMatchObject({ result: 'lost', revives: 0 });
    expect(ends[1]).toMatchObject({ result: 'lost', revives: 1 });
  });
});

describe('RunTracker onEnd', () => {
  it('reports a lost run with its summary and no first_win', () => {
    const { sink, b, tracker } = setup();
    b.wave = 3;
    b.result = 'lost';
    tracker.onEnd();

    expect(sink.events.map((e) => e.name)).toEqual(['run_end']);
    expect(sink.events[0].props).toMatchObject({
      run: 1,
      result: 'lost',
      wave: 3,
      merges: 0,
      maxStar: 1,
      revives: 0,
      wall: 100,
      skills: [],
    });
  });

  it('reports first_win on the first won run only, across trackers of the same player', () => {
    const store = new SafeStore(null);
    const first = setup(store, 1);
    first.b.result = 'won';
    first.tracker.onEnd();
    expect(first.sink.events.map((e) => e.name)).toEqual(['run_end', 'first_win']);
    expect(first.sink.events[0].props).toMatchObject({ result: 'won' });
    expect(first.sink.events[1].props).toEqual({ run: 1 });

    const second = setup(store, 2);
    second.b.result = 'won';
    second.tracker.onEnd();
    expect(second.sink.events.map((e) => e.name)).toEqual(['run_end']);
  });

  it('reports the wall left in percent', () => {
    const { sink, b, tracker } = setup();
    b.wall = b.wallMax / 4;
    b.result = 'lost';
    tracker.onEnd();
    expect(sink.events[0].props.wall).toBe(25);
    b.wall = -5;
    tracker.onEnd();
    expect(sink.events[1].props.wall).toBe(0);
  });
});

describe('RunTracker close', () => {
  it('reports nothing when a fresh run replaces this one', () => {
    const { sink, tracker } = setup();
    tracker.close('again');
    expect(sink.events).toEqual([]);
  });

  it('reports nothing when the page goes away after the run ended', () => {
    const { sink, b, tracker } = setup();
    b.result = 'won';
    tracker.onEnd();
    sink.events.length = 0;
    tracker.close('pagehide');
    expect(sink.events).toEqual([]);
  });

  it('reports a quit once, and not after the run was already closed for a fresh one', () => {
    const quit = setup();
    quit.b.wave = 2;
    quit.tracker.close('pagehide');
    quit.tracker.close('pagehide');
    expect(named(quit.sink, 'run_quit')).toEqual([expect.objectContaining({ result: 'quit', wave: 2 })]);

    const replaced = setup();
    replaced.tracker.close('again');
    replaced.tracker.close('pagehide');
    expect(replaced.sink.events).toEqual([]);
  });

  it('reports a hidden page mid-run once, the run going on, and not after it ended', () => {
    const { sink, b, tracker } = setup();
    b.wave = 2;
    tracker.hidden();
    tracker.hidden();
    expect(named(sink, 'run_hidden')).toEqual([expect.objectContaining({ run: 1, wave: 2 })]);
    tracker.close('pagehide');
    expect(named(sink, 'run_quit')).toHaveLength(1);

    const ended = setup();
    ended.b.result = 'lost';
    ended.tracker.hidden();
    expect(named(ended.sink, 'run_hidden')).toEqual([]);
  });

  it('can quit again once the page came back from the back/forward cache', () => {
    const { sink, b, tracker } = setup();
    b.wave = 2;
    tracker.close('pagehide');
    tracker.reopen();
    b.wave = 5;
    tracker.close('pagehide');
    expect(named(sink, 'run_quit').map((p) => p.wave)).toEqual([2, 5]);
  });
});
