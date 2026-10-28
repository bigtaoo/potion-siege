import type { Application } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sink, TrackedEvent } from '../analytics/analytics';
import { PrivacyChoice, type PrivacyRegion } from '../analytics/privacy';
import { SafeStore, type Platform } from '../platform/types';
import { BUILD } from './keys';
import { createAnalytics, device, loadedBeacon, pointerKind, safeDevice, showLocale, trackSessionStart } from './startup';

const COLLECTOR = 'https://collect.example/e';

/** A browser page at `href`, its listeners kept so a test can fire them. */
function page(href = 'https://potionsiege.example/', opts: { coarse?: boolean; w?: number; h?: number } = {}) {
  const url = new URL(href);
  const listeners: Record<string, (() => void)[]> = {};
  const on = (type: string, fn: () => void) => void (listeners[type] ??= []).push(fn);
  const win = {
    innerWidth: opts.w ?? 800,
    innerHeight: opts.h ?? 600,
    addEventListener: on,
    removeEventListener: (type: string, fn: () => void) => void (listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn)),
  };
  vi.stubGlobal('location', { search: url.search, hostname: url.hostname, protocol: url.protocol });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', { documentElement: { lang: '' }, title: '', referrer: '', visibilityState: 'visible', addEventListener: on });
  vi.stubGlobal('navigator', { languages: ['de-DE'], language: 'de-DE', maxTouchPoints: 0, userAgent: 'Mozilla/5.0', hardwareConcurrency: 8 });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' && !!opts.coarse }));
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn());
  return { win, listeners };
}

/** A platform whose host sink keeps every event it is handed. */
function platform(extra: Partial<Platform> = {}) {
  const events: TrackedEvent[] = [];
  const hostSink: Sink = { send: (e) => void events.push(...e) };
  const p = { name: 'web', storage: new SafeStore(null), languages: () => ['de'], hostSink, ...extra } as unknown as Platform;
  return { p, events };
}

const privacy = (p: Platform, region: PrivacyRegion = 'notice') => new PrivacyChoice(p.storage, region);
const params = (search = '') => new URLSearchParams(search);

/** A WebGL context naming `gpu`, as Pixi's renderer carries it. */
const gl = (gpu: string) => ({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => gpu });
const app = (renderer: unknown) => ({ renderer }) as unknown as Application;
const throwingApp = () =>
  ({
    get renderer(): never {
      throw new Error('context lost');
    },
  }) as unknown as Application;

let fetches: [string, RequestInit | undefined][];

beforeEach(() => {
  vi.useFakeTimers();
  fetches = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => (fetches.push([url, init]), Promise.resolve(new Response())));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('showLocale', () => {
  it("sets the page's lang and title to the language", () => {
    page();
    expect(showLocale('ja')).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.title).toBe('Potion Siege');
  });
});

describe('pointerKind', () => {
  it('splits a coarse pointer from a mouse, and says desktop without matchMedia', () => {
    page('https://potionsiege.example/', { coarse: true });
    expect(pointerKind()).toBe('touch');
    page();
    expect(pointerKind()).toBe('desktop');
    vi.stubGlobal('matchMedia', undefined);
    expect(pointerKind()).toBe('desktop');
  });
});

describe('loadedBeacon', () => {
  it('counts a load once, by host, build, pointer, new player and source', () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    page('https://potionsiege.example/?src=reddit', { coarse: true });
    const { p } = platform();
    const a = createAnalytics(p, params('?src=reddit'), privacy(p));
    loadedBeacon(p, a);
    expect(fetches).toHaveLength(1);
    const [url, init] = fetches[0];
    const q = new URL(url).searchParams;
    expect(url.startsWith('https://collect.example/b?')).toBe(true);
    expect([q.get('h'), q.get('b'), q.get('s'), q.get('n'), q.get('r')]).toEqual(['web', BUILD, 'loaded_touch', '1', 'reddit']);
    expect(Number(q.get('ms'))).toBeGreaterThanOrEqual(0);
    expect(init).toEqual({ mode: 'no-cors', keepalive: true });
  });

  it('marks a returning player as not new', () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    page();
    const { p } = platform();
    createAnalytics(p, params(), privacy(p));
    loadedBeacon(p, createAnalytics(p, params(), privacy(p)));
    expect(new URL(fetches[0][0]).searchParams.get('n')).toBe('0');
  });

  it('sends nothing without a collector, from a blocked host, in autoplay or on a local preview', () => {
    const cases: [string, Partial<Platform>, boolean][] = [
      ['https://potionsiege.example/', {}, false],
      ['https://potionsiege.example/', { collectorBlocked: true }, true],
      ['https://potionsiege.example/?autoplay', {}, true],
      ['http://localhost:4173/', {}, true],
      ['http://127.0.0.1:4173/', {}, true],
      ['http://[::1]:4173/', {}, true],
    ];
    for (const [href, extra, collector] of cases) {
      vi.unstubAllEnvs();
      if (collector) vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
      page(href);
      const { p } = platform(extra);
      loadedBeacon(p, createAnalytics(p, params(), privacy(p)));
      expect(fetches, href).toEqual([]);
    }
  });

  it("counts the iOS app, whose page is capacitor://localhost", () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    page('capacitor://localhost/');
    const { p } = platform({ name: 'ios' } as Partial<Platform>);
    loadedBeacon(p, createAnalytics(p, params(), privacy(p)));
    expect(new URL(fetches[0][0]).searchParams.get('h')).toBe('ios');
  });

  it('never lets a broken fetch reach the game', () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    page();
    const { p } = platform();
    const a = createAnalytics(p, params(), privacy(p));
    vi.stubGlobal('fetch', () => {
      throw new TypeError('blocked');
    });
    expect(() => loadedBeacon(p, a)).not.toThrow();
  });
});

describe('device', () => {
  it('reads the GPU, cores and memory, and calls a touch screen with a phone browser a phone', () => {
    page();
    vi.stubGlobal('navigator', { maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', hardwareConcurrency: 6, deviceMemory: 4 });
    expect(device(app({ gl: gl('Apple GPU') }))).toEqual({ mobile: true, cores: 6, memoryGB: 4, gpu: 'Apple GPU' });
  });

  it('takes a touch laptop for a desktop, and goes on without WebGL details', () => {
    page();
    vi.stubGlobal('navigator', { maxTouchPoints: 10, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(device(throwingApp())).toEqual({ mobile: false, cores: 0, memoryGB: 0, gpu: '' });
  });
});

describe('safeDevice', () => {
  it("reports the renderer's device props", () => {
    page();
    expect(safeDevice(app({ name: 'webgl', gl: gl('ANGLE (NVIDIA GeForce RTX 3060)') }))).toMatchObject({ renderer: 'webgl', cores: 8 });
  });

  it('says nothing rather than throw when the probe fails', () => {
    page();
    expect(safeDevice(throwingApp())).toEqual({});
  });
});

describe('createAnalytics', () => {
  it("hands events to the host's own sink and records the first visit's source", () => {
    page('https://potionsiege.example/?src=reddit');
    const { p, events } = platform();
    const a = createAnalytics(p, params('?src=reddit'), privacy(p));
    a.track('hello');
    expect(events.map((e) => [e.name, e.platform, e.src])).toEqual([['hello', 'web', 'reddit']]);
    expect(a.replays).toBeNull();
  });

  it('logs to the console with ?track', () => {
    page();
    const log = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { p } = platform();
    createAnalytics(p, params('?track'), privacy(p)).track('hello');
    createAnalytics(p, params(), privacy(p)).track('quiet');
    expect(log.mock.calls.map((c) => c[0])).toEqual(['[track] hello']);
    log.mockRestore();
  });

  it('sends to the collector, and its replays, when one is set', async () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    const { listeners } = page();
    const { p } = platform();
    const a = createAnalytics(p, params(), privacy(p));
    expect(a.replays).not.toBeNull();
    expect(Object.keys(listeners).sort()).toEqual(['pagehide', 'visibilitychange']);
    a.track('hello');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetches.map(([url]) => url)).toEqual([COLLECTOR]);
    expect(String(fetches[0][1]?.body)).toContain('"hello"');
  });

  it('keeps the collector out in autoplay and where the host blocks it', async () => {
    vi.stubEnv('VITE_ANALYTICS_URL', COLLECTOR);
    page();
    const blocked = platform({ collectorBlocked: true }).p;
    const open = platform().p;
    const quiet = [createAnalytics(blocked, params(), privacy(blocked)), createAnalytics(open, params('?autoplay'), privacy(open))];
    for (const a of quiet) a.track('hello');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(quiet.map((a) => a.replays)).toEqual([null, null]);
    expect(fetches).toEqual([]);
  });

  it("holds the events of a player who must be asked first, and sends once they say yes", () => {
    page();
    const { p, events } = platform();
    const choice = privacy(p, 'consent');
    const a = createAnalytics(p, params(), choice);
    a.track('hello');
    expect([a.sending, a.playerId, events]).toEqual([false, null, []]);
    choice.set(true);
    a.setSharing(choice.sharing());
    expect(events.map((e) => e.name)).toEqual(['hello']);
    expect(createAnalytics(p, params(), choice).sending).toBe(true);
  });

  it('sends nothing for a player who said no', () => {
    page();
    const { p, events } = platform();
    const choice = privacy(p);
    choice.set(false);
    createAnalytics(p, params(), choice).track('hello');
    expect(events).toEqual([]);
  });
});

describe('trackSessionStart', () => {
  it('tells the session its load time, language, page size, pointer, device and host props', () => {
    page('https://potionsiege.example/', { coarse: true, w: 390, h: 844 });
    const { p, events } = platform({ sessionProps: () => ({ app: 'web', basic: false }) } as Partial<Platform>);
    const a = createAnalytics(p, params(), privacy(p));
    trackSessionStart(a, p, app({ name: 'webgl' }), 'de');
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('session_start');
    expect(events[0].props).toMatchObject({ lang: 'de', langs: 'de', navLangs: 'de-DE', w: 390, h: 844, touch: false, device: 'touch', renderer: 'webgl', app: 'web', basic: false });
    expect(events[0].props.loadMs).toBeTypeOf('number');
  });

  it('starts even when the device probe throws', () => {
    page();
    const { p, events } = platform();
    trackSessionStart(createAnalytics(p, params(), privacy(p)), p, throwingApp(), 'en');
    expect(events[0].props).not.toHaveProperty('renderer');
  });

  it("sends the page's size once a portal's iframe that had none gets one", () => {
    const { win, listeners } = page('https://potionsiege.example/', { w: 0, h: 0 });
    const { p, events } = platform();
    trackSessionStart(createAnalytics(p, params(), privacy(p)), p, app({}), 'en');
    expect(events.map((e) => e.name)).toEqual(['session_start']);
    Object.assign(win, { innerWidth: 1024, innerHeight: 0 });
    for (const fn of [...listeners.resize]) fn();
    expect(events).toHaveLength(1);
    Object.assign(win, { innerWidth: 1024, innerHeight: 576 });
    for (const fn of [...listeners.resize]) fn();
    for (const fn of [...listeners.resize]) fn();
    expect(events.map((e) => [e.name, e.props.w, e.props.h])).toEqual([
      ['session_start', 0, 0],
      ['viewport', 1024, 576],
    ]);
    expect(listeners.resize).toEqual([]);
  });

  it('waits for no size when the page has one', () => {
    const { listeners } = page();
    const { p } = platform();
    trackSessionStart(createAnalytics(p, params(), privacy(p)), p, app({}), 'en');
    expect(listeners.resize).toBeUndefined();
  });
});
