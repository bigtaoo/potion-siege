// A frame that throws (faultRecover.ts) as the real game meets it: reported, the battle in
// progress booked as lost, home put up afresh; recoveries that keep failing reload the page, at
// most once per RESTART_GAP_MS. The real game over a stand-in Pixi app (testWorld.ts).
import '../view/layout/measure';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, type Application, type Ticker } from 'pixi.js';
import { Game } from '../app';
import { Analytics } from '../analytics/analytics';
import { MemorySink } from '../analytics/sinks';
import { PrivacyChoice } from '../analytics/privacy';
import { finish } from './ending';
import { faultHandler } from './faultRecover';
import { RECOVER_GAP_MS, RESTART_GAP_MS, RESTART_KEY, STRIKE_MS, STRIKES } from './faultGuard';
import { englishPage, Host, play, veteran, world, type World } from './testWorld';

vi.mock('./ending', async (orig) => {
  const real = await orig<typeof import('./ending')>();
  return { ...real, finish: vi.fn(real.finish) };
});

beforeAll(englishPage);

let session: Map<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  session = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

/** A veteran a moment into a battle on stage 20 (at the test world's 200x). */
function midBattle(): World {
  const w = world();
  play(w);
  w.game['tick'](0.1);
  expect(w.game['battle']!.result).toBeNull();
  return w;
}

const errors = (w: World) => w.events('anomaly').filter((e) => e.kind === 'error');

describe('a frame that throws', () => {
  it('is reported, books the battle as lost, closes the feedback ask and goes home', () => {
    const w = midBattle();
    const b = w.game['battle']!;
    const runs = w.save().runs;
    const close = vi.fn();
    w.game.ask = { close } as unknown as Game['ask'];
    const reload = vi.fn();
    faultHandler(w.game, reload)(new Error('boom'));
    expect(errors(w)).toEqual([expect.objectContaining({ kind: 'error', frame: 1, place: 'run' })]);
    expect(b.result).toBe('lost');
    expect(w.save().runs).toBe(runs + 1);
    expect(close).toHaveBeenCalledWith('left');
    expect(w.game.ask).toBeNull();
    expect(w.game['menu'].visible).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('still goes home when the battle is too broken to book', () => {
    const w = midBattle();
    const runs = w.save().runs;
    vi.mocked(finish).mockImplementationOnce(() => {
      throw new Error('broken books');
    });
    expect(() => faultHandler(w.game, vi.fn())(new Error('boom'))).not.toThrow();
    expect(w.save().runs).toBe(runs);
    expect(w.game['menu'].visible).toBe(true);
  });

  it('leaves a battle that already has its result as it is, and goes home', () => {
    const w = midBattle();
    const b = w.game['battle']!;
    b.result = 'won';
    faultHandler(w.game, vi.fn())(new Error('boom'));
    expect(finish).not.toHaveBeenCalled();
    expect(b.result).toBe('won');
    expect(w.game['menu'].visible).toBe(true);
  });

  it('waits out a fault right after a recovery: the new battle runs on, unreported', () => {
    const w = midBattle();
    const fault = faultHandler(w.game, vi.fn());
    fault(new Error('boom'));
    play(w);
    later(RECOVER_GAP_MS / 2);
    fault(new Error('again'));
    expect(w.game['battle']!.result).toBeNull();
    expect(w.game['menu'].visible).toBe(false);
    expect(errors(w)).toHaveLength(1);
  });

  it('survives a recovery that throws, and recovers on the next fault', () => {
    const w = midBattle();
    const fault = faultHandler(w.game, vi.fn());
    w.game.ask = {
      close() {
        throw new Error('ask broke');
      },
    } as unknown as Game['ask'];
    expect(() => fault(new Error('boom'))).not.toThrow();
    expect(w.game['menu'].visible).toBe(false);
    w.game.ask = null;
    later(RECOVER_GAP_MS);
    fault(new Error('boom'));
    expect(w.game['menu'].visible).toBe(true);
  });
});

describe('faults that keep coming', () => {
  /** Faults a second apart until `reload` has been called or `n` faults went by. */
  const strikes = (fault: (e: unknown) => void, n: number) => {
    for (let i = 0; i < n; i++) {
      later(RECOVER_GAP_MS);
      fault(new Error(`strike ${i}`));
    }
  };

  it('reload the page once, and note it for after the reload', () => {
    const w = midBattle();
    const reload = vi.fn();
    const fault = faultHandler(w.game, reload);
    strikes(fault, STRIKES - 1);
    expect(reload).not.toHaveBeenCalled();
    strikes(fault, 1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(Number(session.get(RESTART_KEY))).toBe(Date.now());
  });

  it('do not reload again within the restart gap, and are recovered after a rest', () => {
    session.set(RESTART_KEY, String(Date.now()));
    const w = midBattle();
    const reload = vi.fn();
    const fault = faultHandler(w.game, reload);
    strikes(fault, STRIKES * 3);
    expect(reload).not.toHaveBeenCalled();
    later(STRIKE_MS);
    play(w);
    fault(new Error('hours later'));
    expect(w.game['menu'].visible).toBe(true);
  });

  it('reload again once the restart gap has passed', () => {
    session.set(RESTART_KEY, String(Date.now() - RESTART_GAP_MS));
    const reload = vi.fn();
    const fault = faultHandler(midBattle().game, reload);
    strikes(fault, STRIKES);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reload through the page location by default', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const fault = faultHandler(midBattle().game);
    strikes(fault, STRIKES);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("the game's frame", () => {
  it('hands a throw to the fault handler and keeps measuring', () => {
    let frame: ((t: Ticker) => void) | undefined;
    const host = new Host();
    host.storage.setItem('mb.save', JSON.stringify(veteran()));
    const app = { stage: new Container(), ticker: { add: (f: (t: Ticker) => void) => (frame = f) }, screen: { width: 1080, height: 1920 }, renderer: {} } as unknown as Application;
    const sink = new MemorySink();
    const analytics = new Analytics(host.storage, [sink], 'test', host.name);
    const game = new Game(app, host, new URLSearchParams('speed=200'), analytics, new PrivacyChoice(host.storage, 'notice'));
    game['tick'] = () => {
      throw new Error('bad frame');
    };
    expect(() => frame!({ deltaMS: 16 } as Ticker)).not.toThrow();
    analytics.flush();
    expect(sink.events.filter((e) => e.name === 'anomaly').map((e) => e.props)).toEqual([expect.objectContaining({ kind: 'error', frame: 1 })]);
    expect(game['menu'].visible).toBe(true);
  });
});
