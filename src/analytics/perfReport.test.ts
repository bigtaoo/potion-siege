import { describe, expect, it, vi } from 'vitest';
import type { Props } from './analytics';
import { memProbe, type MemSample } from './memProbe';
import { Anomalies, deviceProps, LongTasks, PerfReport } from './perfReport';

function fakeTrack() {
  const events: { name: string; props: Props }[] = [];
  return { events, track: (name: string, props: Props = {}) => void events.push({ name, props }) };
}

type Listener = (e: unknown) => void;

function fakeTarget() {
  const on = new Map<string, Listener>();
  return { on, addEventListener: (type: string, fn: Listener) => void on.set(type, fn) };
}

describe('LongTasks', () => {
  function fakeObserver(entryTypes: string[], throws = false) {
    let cb: ((list: { getEntries: () => { duration: number }[] }) => void) | null = null;
    const observed: unknown[] = [];
    class Obs {
      static supportedEntryTypes = entryTypes;
      constructor(fn: typeof cb) {
        cb = fn;
      }
      observe(opts: unknown) {
        if (throws) throw new Error('no');
        observed.push(opts);
      }
    }
    return { Obs: Obs as unknown as typeof PerformanceObserver, observed, fire: (ms: number[]) => cb!({ getEntries: () => ms.map((duration) => ({ duration })) }) };
  }

  it('sums the long tasks the observer sees while active', () => {
    const o = fakeObserver(['longtask']);
    const lt = new LongTasks(o.Obs);
    expect(lt.supported).toBe(true);
    expect(o.observed).toEqual([{ type: 'longtask', buffered: false }]);
    o.fire([300]); // not measuring yet
    lt.active = true;
    o.fire([60, 90.4]);
    expect(lt.take()).toEqual({ longMs: 150, longN: 2 });
    expect(lt.take()).toEqual({ longMs: 0, longN: 0 });
  });

  it('is unsupported where the browser has no longtask entries or observe throws', () => {
    expect(new LongTasks(fakeObserver(['paint']).Obs).take()).toEqual({});
    const lt = new LongTasks(fakeObserver(['longtask'], true).Obs);
    expect(lt.supported).toBe(false);
    expect(lt.take()).toEqual({});
  });
});

describe('Anomalies listening', () => {
  it('reports uncaught errors, rejections and a lost context', () => {
    const a = fakeTrack();
    const an = new Anomalies(a, () => ({ place: 'home' }), () => ({ tex: 12, texMB: 34, nodes: 56, heap: 78 }));
    const win = fakeTarget();
    const canvas = fakeTarget();
    an.listen(win, canvas);
    win.on.get('error')!({ message: 'x is null', filename: 'https://h/a/index-abc.js', lineno: 1, colno: 9 });
    win.on.get('error')!({ message: '', error: 'thrown string' });
    win.on.get('unhandledrejection')!({ reason: new Error('fetch failed') });
    win.on.get('unhandledrejection')!({ reason: 42 });
    canvas.on.get('webglcontextlost')!({});
    expect(a.events.map((e) => e.props)).toEqual([
      { kind: 'error', place: 'home', msg: 'x is null', src: 'index-abc.js:1:9' },
      { kind: 'error', place: 'home', msg: 'thrown string' },
      { kind: 'rejection', place: 'home', msg: 'fetch failed' },
      { kind: 'rejection', place: 'home', msg: '42' },
      { kind: 'webgl_lost', place: 'home', tex: 12, texMB: 34, nodes: 56, heap: 78 },
    ]);
  });

  it('leaves the heap out of a lost context where the browser hides it, and listens without a canvas', () => {
    const a = fakeTrack();
    const an = new Anomalies(a, () => ({ place: 'run', wave: 3 }), () => ({ tex: 1, texMB: 2, nodes: 3 }));
    const win = fakeTarget();
    an.listen(win);
    expect([...win.on.keys()]).toEqual(['error', 'unhandledrejection']);
    an.report('webgl_lost');
    expect(a.events[0].props).toEqual({ kind: 'webgl_lost', place: 'run', wave: 3, tex: 1, texMB: 2, nodes: 3 });
  });

  it('swallows a failure inside its own reporting', () => {
    const an = new Anomalies({ track: () => { throw new Error('sink down'); } }, () => ({ place: 'run' }));
    const win = fakeTarget();
    an.listen(win);
    expect(() => win.on.get('unhandledrejection')!({ reason: 'x' })).not.toThrow();
  });
});

describe('deviceProps', () => {
  it('reads the gpu as hidden when WebGL throws', () => {
    const gl = { getExtension: () => { throw new Error('lost'); } };
    expect(deviceProps({ name: 'webgl', gl }, {}, 0).gpu).toBe('hidden');
  });

  it('falls back to the plain renderer without the debug extension', () => {
    const gl = { RENDERER: 7, getExtension: () => null, getParameter: (p: number) => (p === 7 ? 'Mali-G52' : null) };
    expect(deviceProps({ gl }, {}, 1)).toMatchObject({ gpu: 'weak', renderer: 'unknown' });
  });
});

describe('PerfReport', () => {
  const quietTasks = () => new LongTasks(undefined);

  it('sends a quit snapshot and nothing after, until the next run', () => {
    const a = fakeTrack();
    const r = new PerfReport(a, () => ({ tex: 1, texMB: 1, nodes: 1 }), () => ({ place: 'run' }), 1, quietTasks());
    r.start();
    for (let i = 0; i < 400; i++) r.tick(16, true, 0);
    r.quit();
    r.end();
    r.tick(16, true, 0);
    expect(a.events.map((e) => e.props.why)).toEqual(['quit']);
  });

  it('carries the heap and its growth where the browser shows it', () => {
    const a = fakeTrack();
    let heap: number | undefined;
    const r = new PerfReport(a, () => ({ tex: 1, texMB: 1, nodes: 1, ...(heap === undefined ? {} : { heap }) }), () => ({ place: 'run' }), 1, quietTasks());
    r.start();
    heap = 50;
    for (let i = 0; i < 400; i++) r.tick(16, true, 0);
    heap = 80;
    r.end();
    expect(a.events[0].props).toMatchObject({ heap: 80, heapUp: 30 });
    // a base taken before the heap showed gives the heap but no growth
    heap = undefined;
    r.start();
    for (let i = 0; i < 400; i++) r.tick(16, true, 0);
    heap = 90;
    r.end();
    expect(a.events[1].props.heap).toBe(90);
    expect(a.events[1].props).not.toHaveProperty('heapUp');
  });

  it('skips a mid due too soon after the meter was reset', () => {
    const a = fakeTrack();
    let nodes = 1;
    const r = new PerfReport(a, () => ({ tex: 1, texMB: 1, nodes }), () => ({ place: 'run' }), 1, quietTasks());
    r.start();
    for (let i = 0; i < 178 * 50; i++) r.tick(20, true, 0);
    r.end(); // the meter resets, the run's battle time goes on
    nodes = 9000; // would look wrong, were there enough seconds to judge
    for (let i = 0; i < 3 * 50; i++) r.tick(20, true, 0);
    expect(a.events.map((e) => e.props.why)).toEqual(['end']);
  });
});

describe('memProbe', () => {
  it('reads the stage, the managed textures and the heap', () => {
    const stage = { children: [{ children: [{}] }, {}] };
    const renderer = { texture: { managedTextures: [{ pixelWidth: 1024, pixelHeight: 512 }, null] } };
    const spy = vi.spyOn(globalThis, 'performance', 'get').mockReturnValue({ memory: { usedJSHeapSize: 3 * 2 ** 20 } } as never);
    const sample: MemSample = memProbe({ stage, renderer })();
    spy.mockRestore();
    expect(sample).toEqual({ tex: 1, texMB: 2, nodes: 4, heap: 3 });
  });

  it('gives no textures for a renderer without them, and no heap where hidden', () => {
    const spy = vi.spyOn(globalThis, 'performance', 'get').mockReturnValue({} as never);
    const sample = memProbe({ stage: {}, renderer: {} })();
    spy.mockRestore();
    expect(sample).toEqual({ tex: 0, texMB: 0, nodes: 1 });
  });
});
