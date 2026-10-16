import { describe, expect, it, vi } from 'vitest';
import { coresBucket, perfSummary, printPerf } from '../../scripts/perfSummary.mjs';
import type { Props } from './analytics';
import { countNodes, heapMB, textureStats, type MemSample } from './memProbe';
import { gpuClass, PERF_MID_MAX, PERF_MID_SECS, PerfMeter, perfTrouble } from './perfMeter';
import { ANOMALY_CAP, ANOMALY_TOTAL, Anomalies, deviceProps, errorProps, LongTasks, PerfReport } from './perfReport';

const noLongTasks = () => new LongTasks(undefined);

function feed(m: PerfMeter, ms: number, secs: number, mobs = 0): void {
  for (let t = 0; t < secs * 1000; t += ms) m.frame(ms, mobs);
}

describe('PerfMeter', () => {
  it('gives the median and 5th percentile in whole fps', () => {
    const m = new PerfMeter();
    feed(m, 1000 / 60, 19); // 95%
    feed(m, 1000 / 20, 4); // the slow 6.5%: 80 frames of 1220
    const s = m.snapshot('end')!;
    expect(s.fps).toBe(60);
    expect(s.p5).toBe(20);
    expect(s.long).toBe(80);
    expect(s.secs).toBe(23);
  });

  it('counts a long pause as long but leaves it out of the rates', () => {
    const m = new PerfMeter();
    feed(m, 1000 / 60, 6);
    m.frame(800, 3);
    const s = m.snapshot('end')!;
    expect(s.long).toBe(1);
    expect(s.p5).toBe(60);
    expect(s.secs).toBe(6);
    expect(s.mobs).toBe(3);
  });

  it('makes no snapshot under PERF_MIN_SECS and resets after one', () => {
    const m = new PerfMeter();
    feed(m, 16, 3);
    expect(m.snapshot('end')).toBeNull();
    feed(m, 16, 3);
    expect(m.snapshot('end')).not.toBeNull();
    expect(m.secs).toBe(0);
  });

  it('is due a mid every PERF_MID_SECS, at most PERF_MID_MAX', () => {
    const m = new PerfMeter();
    let looks = 0;
    for (let i = 0; i < (PERF_MID_MAX + 2) * PERF_MID_SECS * 10; i++) {
      m.frame(100, 0);
      if (m.midDue()) {
        looks++;
        m.snapshot('mid', true);
      }
    }
    expect(looks).toBe(PERF_MID_MAX);
  });
});

describe('perfTrouble', () => {
  const ok = { secs: 180, p5: 55, long: 3, texUp: 0, nodesUp: 100 };
  it('passes a healthy stretch', () => expect(perfTrouble(ok)).toBe(false));
  it.each([
    ['slow p5', { p5: 39 }],
    ['long frames', { long: 19 }],
    ['heap', { heapUp: 50 }],
    ['textures', { texUp: 30 }],
    ['nodes', { nodesUp: 3000 }],
  ])('flags %s', (_, bad) => expect(perfTrouble({ ...ok, ...bad })).toBe(true));
});

describe('memProbe helpers', () => {
  it('counts every node of a deep tree without recursion', () => {
    let root: { children: unknown[] } = { children: [] };
    const top = root;
    for (let i = 0; i < 20_000; i++) {
      const kid = { children: [{}] };
      root.children.push(kid);
      root = kid;
    }
    expect(countNodes(top as never)).toBe(40_001);
  });

  it('sums textures, skipping unloaded ones', () => {
    expect(textureStats([{ pixelWidth: 1024, pixelHeight: 1024 }, null, { pixelWidth: 512, pixelHeight: 512 }, undefined])).toEqual({ tex: 2, texMB: 5 });
  });

  it('reads the heap only where the browser shows it', () => {
    expect(heapMB({ memory: { usedJSHeapSize: 64 * 2 ** 20 } })).toBe(64);
    expect(heapMB({})).toBeUndefined();
  });
});

describe('device and errors', () => {
  it('classes GPUs', () => {
    expect(gpuClass('')).toBe('hidden');
    expect(gpuClass('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))')).toBe('software');
    expect(gpuClass('Mali-G52 MC2')).toBe('weak');
    expect(gpuClass('ANGLE (NVIDIA GeForce RTX 3060)')).toBe('other');
  });

  it('reads the device fields', () => {
    const gl = { RENDERER: 1, getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 2 }), getParameter: (p: number) => (p === 2 ? 'Adreno (TM) 506' : 'WebKit WebGL') };
    expect(deviceProps({ name: 'webgl', gl }, { deviceMemory: 4, hardwareConcurrency: 8 }, 2.625)).toEqual({ mem: 4, cores: 8, gpu: 'weak', dpr: 2.63, renderer: 'webgl' });
    expect(deviceProps({ name: 'webgpu' }, {}, 1)).toEqual({ mem: 0, cores: 0, gpu: 'hidden', dpr: 1, renderer: 'webgpu' });
  });

  it('cuts error messages and keeps the script name', () => {
    const p = errorProps('x'.repeat(100), 'https://cdn.example/assets/index-abc.js?v=2', 1, 2345);
    expect(p).toEqual({ msg: 'x'.repeat(64), src: 'index-abc.js:1:2345' });
  });
});

function fakeTrack() {
  const events: { name: string; props: Props }[] = [];
  return { events, track: (name: string, props: Props = {}) => void events.push({ name, props }) };
}

describe('Anomalies', () => {
  it('caps each kind and the session', () => {
    const a = fakeTrack();
    const an = new Anomalies(a, () => ({ place: 'run', wave: 4 }));
    for (let i = 0; i < 10; i++) an.report('stall', { ms: 1200 });
    expect(a.events).toHaveLength(ANOMALY_CAP);
    expect(a.events[0].props).toEqual({ kind: 'stall', place: 'run', ms: 1200, wave: 4 });
    for (const k of ['error', 'rejection', 'webgl_lost'] as const) for (let i = 0; i < 5; i++) an.report(k);
    expect(a.events).toHaveLength(ANOMALY_TOTAL);
  });
});

describe('PerfReport', () => {
  function setup(mem: () => MemSample) {
    const a = fakeTrack();
    const lt = noLongTasks();
    const r = new PerfReport(a, mem, () => ({ place: 'run', wave: 1 }), 2, lt);
    return { a, r };
  }

  it('measures battle frames only and reports growth since the first battle frame', () => {
    let nodes = 500;
    const { a, r } = setup(() => ({ tex: 40, texMB: 30, nodes }));
    r.start();
    for (let i = 0; i < 600; i++) r.tick(16, false, 0); // menus and overlays
    for (let i = 0; i < 400; i++) {
      r.tick(16, true, 5);
      nodes++;
    }
    r.end();
    const perf = a.events.filter((e) => e.name === 'perf');
    expect(perf).toHaveLength(1);
    expect(perf[0].props).toMatchObject({ why: 'end', secs: 6, fps: 63, nth: 1, speed: 2, nodes: 900, nodesUp: 400, texUp: 0, mobs: 5 });
  });

  it('skips the frame after a hidden tab and sends a leave snapshot', () => {
    const { a, r } = setup(() => ({ tex: 1, texMB: 1, nodes: 1 }));
    r.start();
    for (let i = 0; i < 400; i++) r.tick(16, true, 0);
    r.hidden();
    r.tick(30_000, true, 0);
    expect(a.events.map((e) => [e.name, e.props.why])).toEqual([['perf', 'leave']]);
  });

  it('sends a stall anomaly for one long battle frame', () => {
    const { a, r } = setup(() => ({ tex: 1, texMB: 1, nodes: 1 }));
    r.start();
    r.tick(1500, true, 0);
    r.tick(1500, false, 0);
    expect(a.events).toEqual([{ name: 'anomaly', props: { kind: 'stall', place: 'run', wave: 1, ms: 1500 } }]);
  });

  it('sends a mid only when something looks wrong', () => {
    let nodes = 100;
    const { a, r } = setup(() => ({ tex: 1, texMB: 1, nodes }));
    r.start();
    const minute = () => {
      for (let i = 0; i < 3750; i++) r.tick(16, true, 0);
    };
    for (let m = 0; m < 3; m++) minute(); // 180 s healthy
    expect(a.events).toHaveLength(0);
    nodes = 5000;
    for (let m = 0; m < 3; m++) minute();
    expect(a.events.map((e) => [e.props.why, e.props.secs])).toEqual([['mid', 360]]);
  });

  it('logs once and turns off when the probe throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { r } = setup(() => {
      throw new Error('boom');
    });
    r.start();
    expect(() => {
      for (let i = 0; i < 10; i++) r.tick(16, true, 0);
      r.end();
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('adds the long tasks seen in battle to the snapshot', () => {
    const a = fakeTrack();
    const lt = new LongTasks(undefined);
    (lt as { supported: boolean }).supported = true;
    const r = new PerfReport(a, () => ({ tex: 1, texMB: 1, nodes: 1 }), () => ({ place: 'run' }), 1, lt);
    r.start();
    for (let i = 0; i < 400; i++) r.tick(16, true, 0);
    lt.add(120);
    lt.add(80);
    r.end();
    expect(a.events[0].props).toMatchObject({ longMs: 200, longN: 2 });
  });
});

describe('perfSummary', () => {
  const ev = (name: string, sid: string, props: Record<string, unknown>) => ({ name, sid, props });
  const perf = (sid: string, p: Record<string, unknown>) => ev('perf', sid, { why: 'end', secs: 60, fps: 60, p5: 50, long: 2, tex: 40, texUp: 0, texMB: 30, nodes: 600, nodesUp: 100, ...p });
  const events = [
    ev('session_start', 'a', { gpu: 'other', cores: 8 }),
    ev('session_start', 'b', { gpu: 'weak', cores: 4 }),
    perf('a', { nth: 1, longMs: 300, longN: 3 }),
    perf('a', { nth: 2, nodes: 900, nodesUp: 100, tex: 45, texUp: 0 }),
    perf('b', { nth: 1, fps: 40, p5: 22, long: 12, heap: 80, heapUp: 10 }),
    ev('anomaly', 'b', { kind: 'stall', ms: 1200 }),
    ev('anomaly', 'b', { kind: 'error', msg: 'x is undefined', src: 'index.js:1:2' }),
    ev('anomaly', 'a', { kind: 'error', msg: 'x is undefined', src: 'index.js:1:2' }),
  ];
  const s = perfSummary(events);

  it('groups rates by gpu class and cores', () => {
    expect(s.byGpu).toEqual([
      { gpu: 'other', n: 2, mins: 2, fps: 60, p5: 50, longPerMin: 2 },
      { gpu: 'weak', n: 1, mins: 1, fps: 40, p5: 22, longPerMin: 12 },
    ]);
    expect(s.byCores.map((r) => r.cores)).toEqual(['3-4', '5-8']);
    expect(coresBucket(0)).toBe('?');
    expect(s.all.longPerMin).toBeCloseTo(5.3);
  });

  it('sums long tasks a minute over snapshots that report them', () => {
    expect(s.longTasks).toEqual({ n: 1, msPerMin: 300, perMin: 3 });
  });

  it('shows the start values climbing by nth', () => {
    expect(s.byNth.map((r) => [r.nth, r.nodes0, r.tex0])).toEqual([[1, 500, 40], [2, 800, 45]]);
    expect(s.byNth[0].heapUp).toBe(10);
  });

  it('counts anomalies and the top errors', () => {
    expect(s.anomalies).toEqual({ error: 2, stall: 1 });
    expect(s.topErrors).toEqual([['x is undefined @ index.js:1:2', 2]]);
    const lines: string[] = [];
    printPerf(s, (l) => lines.push(l));
    expect(lines.join('\n')).toContain('anomalies: error 2, stall 1');
  });
});
