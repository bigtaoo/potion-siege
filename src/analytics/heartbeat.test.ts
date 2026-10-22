import { describe, expect, it, vi } from 'vitest';
import { SafeStore } from '../platform/types';
import { Analytics, type Props } from './analytics';
import { ALIVE_EVERY, Heartbeat, watchPage } from './heartbeat';
import { sharingOf } from './privacy';
import { MemorySink } from './sinks';

/** A beat on a hand-moved clock; `track` records every event. */
function beat(visible = true) {
  const time = { now: 0 };
  const sent: [string, Props | undefined][] = [];
  const b = new Heartbeat({ track: (name, props) => sent.push([name, props]) }, () => ({ place: 'run', wave: 3 }), () => time.now, visible);
  /** `secs` seconds pass, ticked every second. */
  const play = (secs: number) => {
    for (let i = 0; i < secs; i++) {
      time.now += 1000;
      b.tick();
    }
  };
  return { time, sent, b, play };
}

describe('Heartbeat', () => {
  it('beats once a minute on screen with the total and where the player is', () => {
    const { sent, b, play } = beat();
    play(ALIVE_EVERY - 1);
    expect(sent).toEqual([]);
    play(1);
    expect(sent).toEqual([['alive', { vis: 60, place: 'run', wave: 3 }]]);
    play(2 * ALIVE_EVERY);
    expect(sent.map(([, p]) => p?.vis)).toEqual([60, 120, 180]);
    expect(b.seconds).toBe(180);
  });

  it('stops counting while the tab is hidden and goes on when it is shown', () => {
    const { time, sent, b, play } = beat();
    play(40);
    b.hide();
    time.now += 10 * 60_000; // ten minutes in another tab
    b.tick();
    expect(b.seconds).toBe(40);
    b.show();
    play(19);
    expect(sent).toEqual([]);
    play(1);
    expect(sent).toEqual([['alive', { vis: 60, place: 'run', wave: 3 }]]);
  });

  it('starts hidden when the page loads in a background tab', () => {
    const { time, b, play } = beat(false);
    time.now += 30_000;
    b.tick();
    expect(b.seconds).toBe(0);
    b.show();
    play(5);
    expect(b.seconds).toBe(5);
  });

  it('counts a long gap between ticks (a computer asleep, the tab in front) as a few seconds', () => {
    const { time, sent, b } = beat();
    time.now += 3 * 3_600_000;
    b.tick();
    expect(b.seconds).toBe(5);
    expect(sent).toEqual([]);
  });

  it('keeps what it counted when the page is hidden mid-second', () => {
    const { time, b } = beat();
    time.now += 2500;
    b.hide();
    time.now += 2500;
    b.show();
    time.now += 600;
    b.hide();
    expect(b.seconds).toBe(3);
  });
});

describe('Heartbeat behind the privacy answer', () => {
  /** Ten minutes on screen for a player whose answer means `sharing`. */
  function tenMinutes(sharing: ReturnType<typeof sharingOf>) {
    const store = new SafeStore(null);
    const sink = new MemorySink();
    const a = new Analytics(store, [sink], '1', 'web', undefined, undefined, sharing);
    let now = 0;
    const b = new Heartbeat(a, () => ({ place: 'home' }), () => now);
    for (let i = 0; i < 600; i++) {
      now += 1000;
      b.tick();
    }
    return { store, sink, a };
  }

  it('sends nothing in the EEA before Allow, then the beats that waited', () => {
    const { store, sink, a } = tenMinutes(sharingOf('consent', 'ask'));
    expect(sink.events).toEqual([]);
    expect(store.getItem('mb.player')).toContain('"id":""');
    a.setSharing('send');
    expect(sink.events.map((e) => e.props.vis)).toEqual([60, 120, 180, 240, 300, 360, 420, 480, 540, 600]);
    expect(new Set(sink.events.map((e) => e.uid)).size).toBe(1);
    expect(sink.events[0].uid).not.toBe('');
  });

  it('drops the beats for good when the player says no', () => {
    const { sink, a } = tenMinutes(sharingOf('consent', 'no'));
    a.setSharing('off');
    expect(sink.events).toEqual([]);
  });

  it('sends them as they come where nobody is asked first', () => {
    const { sink } = tenMinutes(sharingOf('notice', 'ask'));
    expect(sink.events).toHaveLength(10);
    expect(sink.events.every((e) => e.name === 'alive')).toBe(true);
  });
});

describe('watchPage', () => {
  function page() {
    const win = new EventTarget() as EventTarget & { setInterval: (f: () => void, ms: number) => number };
    let interval: (() => void) | null = null;
    win.setInterval = (f) => {
      interval = f;
      return 1;
    };
    const doc = new EventTarget() as EventTarget & { visibilityState: string };
    doc.visibilityState = 'visible';
    const fire = (target: EventTarget, type: string, persisted?: boolean) => target.dispatchEvent(Object.assign(new Event(type), persisted === undefined ? {} : { persisted }));
    const beat = { tick: vi.fn(), hide: vi.fn(), show: vi.fn() };
    const away = vi.fn();
    const back = vi.fn();
    watchPage(beat as unknown as Heartbeat, away, back, win as unknown as Window, doc as unknown as Document);
    return { win, doc, fire, beat, away, back, interval: () => interval?.() };
  }

  it('ticks every second and follows the tab', () => {
    const { doc, fire, beat, interval } = page();
    interval();
    expect(beat.tick).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'hidden';
    fire(doc, 'visibilitychange');
    expect(beat.hide).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    fire(doc, 'visibilitychange');
    expect(beat.show).toHaveBeenCalledTimes(1);
  });

  it('leaves once per time away, again after a back/forward restore', () => {
    const { win, fire, beat, away, back } = page();
    fire(win, 'pagehide', true);
    fire(win, 'pagehide', true); // a portal swapping its iframe out after the tab closed
    expect(away).toHaveBeenCalledTimes(1);
    fire(win, 'pageshow', false); // the first load's pageshow is no restore
    expect(back).not.toHaveBeenCalled();
    fire(win, 'pageshow', true);
    expect(back).toHaveBeenCalledTimes(1);
    expect(beat.show).toHaveBeenCalled();
    fire(win, 'pagehide', true);
    expect(away).toHaveBeenCalledTimes(2);
  });
});
