// boot() over a stand-in page and Pixi app: the renderer it asks for, the page events it listens
// to, the first frame's mark, the rest of the art coming in and a newer tab taking over.
import './view/layout/measure';
import { Container } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedEvent } from './analytics/analytics';
import { boot } from './app';
import { Host, veteran } from './game/testWorld';
import { newMeta, type MetaSave } from './sim/meta';

const art = vi.hoisted(() => ({ rest: null as null | (() => void) }));

vi.mock('pixi.js', async (actual) => {
  const pixi = await actual<typeof import('pixi.js')>();
  class Application {
    static last: Application;
    stage = new pixi.Container();
    screen = { width: 1080, height: 1920 };
    canvas = new EventTarget();
    renderer = { resolution: 1, resize() {} };
    ticker = { autoStart: true, add() {}, stop() {}, update() {} };
    options: Record<string, unknown> = {};
    async init(options: Record<string, unknown>) {
      this.options = options;
      Application.last = this;
    }
  }
  return { ...pixi, Application };
});

vi.mock('./view/art', async (actual) => ({
  ...(await actual<typeof import('./view/art')>()),
  loadArt: () => Promise.resolve(),
  restOfArt: () => new Promise<void>((r) => (art.rest = r)),
}));

type Fn = (e?: unknown) => void;

/** A page whose listeners, animation frames and tab channel a test can fire. */
function page(opts: { dpr?: number } = {}) {
  const on: Record<string, Fn[]> = {};
  const target = (prefix: string) => ({
    addEventListener: (type: string, fn: Fn) => void (on[prefix + type] ??= []).push(fn),
    removeEventListener: (type: string, fn: Fn) => void (on[prefix + type] = (on[prefix + type] ?? []).filter((f) => f !== fn)),
  });
  const frames: Fn[] = [];
  const channel: { hear: Fn | null; said: unknown[] } = { hear: null, said: [] };
  const appended: unknown[] = [];
  const el = () => ({ style: {}, textContent: '', addEventListener() {}, append() {} });
  const body = { appendChild: (c: unknown) => void appended.push(c), ownerDocument: { createElement: el } };
  vi.stubGlobal('window', {
    ...target('win:'),
    devicePixelRatio: opts.dpr ?? 1,
    innerWidth: 800,
    innerHeight: 600,
    setInterval: () => 0,
    BroadcastChannel: class {
      postMessage = (m: unknown) => void channel.said.push(m);
      addEventListener = (_: string, fn: Fn) => void (channel.hear = fn);
    },
  });
  const doc = { ...target('doc:'), documentElement: { lang: '' }, title: '', referrer: '', visibilityState: 'visible', body };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('location', { search: '?quality=low', hostname: 'localhost', protocol: 'http:', reload() {} });
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en', maxTouchPoints: 0, userAgent: 'Mozilla/5.0', hardwareConcurrency: 8 });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (fn: Fn) => frames.push(fn));
  const fire = (key: string, e: unknown = {}) => [...(on[key] ?? [])].forEach((fn) => fn(e));
  return { on, fire, frames, channel, appended, doc };
}

function host(save: MetaSave, extra: Partial<Host> = {}) {
  const h = Object.assign(new Host(), { country: () => 'US' }, extra);
  const events: TrackedEvent[] = [];
  Object.assign(h, { hostSink: { send: (e: TrackedEvent[]) => void events.push(...e) } });
  h.storage.setItem('mb.save', JSON.stringify(save));
  const names = () => events.map((e) => e.name);
  return { h, events, names };
}

const pixiApp = async () => ((await import('pixi.js')) as unknown as { Application: { last: { options: Record<string, unknown>; canvas: EventTarget; stage: Container } } }).Application.last;

beforeEach(() => {
  art.rest = null;
});
afterEach(() => vi.unstubAllGlobals());

describe('boot', () => {
  it('starts a new player in the first battle on a smooth-edged renderer at the screen density', async () => {
    const p = page({ dpr: 1.5 });
    const { h, names } = host(newMeta());
    const handle = await boot(h);
    const app = await pixiApp();
    expect(app.options).toMatchObject({ resolution: 1.5, antialias: true, autoDensity: true });
    expect(p.appended).toContain(app.canvas);
    expect(p.doc.documentElement.lang).toBe('en');
    expect(names()).toContain('session_start');
    expect(handle.refresh).toBeTypeOf('function');
    const game = (window as unknown as { __game: { menu: Container; battle: unknown; tutorial: unknown } }).__game;
    expect(game.menu.visible).toBe(false);
    expect(game.tutorial).not.toBeNull();
  });

  it('keeps an iPhone at its own resolution cap, with no antialias, on the host mount', async () => {
    page({ dpr: 3 });
    const mounted: unknown[] = [];
    const { h } = host(veteran(), { name: 'ios', mount: { appendChild: (c: unknown) => mounted.push(c) } } as never);
    await boot(h);
    const app = await pixiApp();
    expect(app.options.resolution).toBe(2);
    expect(app.options.antialias).toBe(false);
    expect(mounted).toEqual([app.canvas]);
  });

  it('counts the first input once, flushes on a hidden page and marks the first frame', async () => {
    const p = page();
    const { h, names } = host(newMeta());
    await boot(h);
    const app = await pixiApp();
    const menu = new Event('contextmenu', { cancelable: true });
    app.canvas.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    p.fire('win:pointerdown');
    p.fire('win:keydown');
    expect(p.on['win:pointerdown']).toHaveLength(0);
    p.doc.visibilityState = 'hidden';
    p.fire('doc:visibilitychange');
    expect(names().filter((n) => n === 'first_input')).toHaveLength(1);
    expect(names()).toContain('run_hidden');
    p.doc.visibilityState = 'visible';
    p.fire('doc:visibilitychange');
    const mark = vi.spyOn(performance, 'mark');
    // the quality loop's frame and the first-frame mark's
    p.frames.splice(0).forEach((f) => f(0));
    p.frames.splice(0).forEach((f) => f(16));
    expect(mark).toHaveBeenCalledWith('first_frame');
  });

  it('builds the home again once the rest of the art is in, and stops when a newer tab takes over', async () => {
    const p = page();
    const { h } = host(veteran());
    await boot(h);
    const game = (window as unknown as { __game: { menu: Container; tabs: { stale: boolean } } }).__game;
    const first = game.menu.children[0];
    art.rest!();
    await Promise.resolve();
    await Promise.resolve();
    expect(game.menu.children[0]).not.toBe(first);
    expect(p.channel.said).toHaveLength(1);
    p.channel.hear!({ data: 'a-newer-tab' });
    expect(game.tabs.stale).toBe(true);
    expect(p.appended).toHaveLength(2);
  });
});

describe('boot on rarer pages', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads a page with no pixel ratio as 1x, takes a quality mode it knows, and goes without a country', async () => {
    page({ dpr: 0 });
    vi.stubGlobal('location', { search: '?quality=saver', hostname: 'localhost', protocol: 'http:', reload() {} });
    const { h } = host(veteran(), { country: undefined } as never);
    await boot(h);
    const app = await pixiApp();
    expect(app.options.resolution).toBe(1);
    expect(app.options.antialias).toBe(true);
  });

  it('keeps the game off the window in a release build', async () => {
    page();
    vi.stubEnv('DEV', false);
    const { h } = host(veteran());
    await boot(h);
    expect((window as unknown as { __game?: unknown }).__game).toBeUndefined();
  });

  it('leaves on pagehide and goes on when the page comes back from the back/forward cache', async () => {
    const p = page();
    const { h, names } = host(newMeta());
    await boot(h);
    const game = (window as unknown as { __game: { run: { closed: boolean } | null } }).__game;
    p.fire('win:pagehide');
    expect(names()).toContain('session_end');
    p.fire('win:pageshow', { persisted: true });
    expect(names().filter((n) => n === 'session_end')).toHaveLength(1);
    expect(game.run).not.toBeNull();
  });
});
