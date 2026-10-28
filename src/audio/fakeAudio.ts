// A small stand-in for Web Audio, a render worker and the page, for the engine's tests: every
// node records what it is connected to, every param what was scheduled on it, and the context
// moves between suspended and running like a browser's does.

import { vi } from 'vitest';
import { GameAudio } from './engine';
import type { RenderJob } from './render.worker';
import { SFX_IDS } from './sfx';

export class FakeParam {
  value: number;
  readonly calls: [string, ...number[]][] = [];
  constructor(value = 0) {
    this.value = value;
  }
  setTargetAtTime(v: number, t: number, k: number): void {
    this.calls.push(['target', v, t, k]);
    this.value = v;
  }
  setValueAtTime(v: number, t: number): void {
    this.calls.push(['set', v, t]);
    this.value = v;
  }
  linearRampToValueAtTime(v: number, t: number): void {
    this.calls.push(['ramp', v, t]);
    this.value = v;
  }
  cancelScheduledValues(t: number): void {
    this.calls.push(['cancel', t]);
  }
}

export class FakeNode {
  readonly out: FakeNode[] = [];
  constructor(readonly kind: string) {}
  connect<T extends FakeNode>(n: T): T {
    this.out.push(n);
    return n;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
  constructor() {
    super('gain');
  }
}

export class FakeBuffer {
  private readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(ch: number): Float32Array {
    return this.data[ch];
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
  started: number | null = null;
  stopped: number | null = null;
  constructor() {
    super('source');
  }
  start(t = 0): void {
    this.started = t;
  }
  stop(t = 0): void {
    this.stopped = t;
  }
}

export class FakeContext {
  /** Every context made, newest last. */
  static made: FakeContext[] = [];
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  readonly sampleRate = 8000;
  readonly destination = new FakeNode('destination');
  readonly nodes: FakeNode[] = [];
  readonly calls: string[] = [];
  /** Make resume() or suspend() reject instead of changing state. */
  failNext = false;
  private readonly listeners: (() => void)[] = [];

  constructor() {
    FakeContext.made.push(this);
  }

  private add<T extends FakeNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  createGain(): FakeGain {
    return this.add(new FakeGain());
  }
  createBufferSource(): FakeSource {
    return this.add(new FakeSource());
  }
  createConvolver(): FakeNode & { buffer: FakeBuffer | null } {
    return this.add(Object.assign(new FakeNode('convolver'), { buffer: null }));
  }
  createDynamicsCompressor(): FakeNode & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', FakeParam> {
    const p = () => new FakeParam();
    return this.add(Object.assign(new FakeNode('compressor'), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() }));
  }
  createStereoPanner(): FakeNode & { pan: FakeParam } {
    return this.add(Object.assign(new FakeNode('panner'), { pan: new FakeParam() }));
  }
  createBuffer(channels: number, length: number, sr: number): FakeBuffer {
    return new FakeBuffer(channels, length, sr);
  }
  addEventListener(type: string, fn: () => void): void {
    if (type === 'statechange') this.listeners.push(fn);
  }
  /** Moves to a state as the browser would, telling the listeners. */
  become(state: FakeContext['state']): void {
    this.state = state;
    for (const fn of this.listeners) fn();
  }
  resume(): Promise<void> {
    return this.change('resume', 'running');
  }
  suspend(): Promise<void> {
    return this.change('suspend', 'suspended');
  }
  private change(call: string, to: FakeContext['state']): Promise<void> {
    this.calls.push(call);
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error(`${call} refused`));
    }
    this.state = to;
    return Promise.resolve();
  }
  of(kind: string): FakeNode[] {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

export class FakeWorker {
  static made: FakeWorker[] = [];
  readonly posted: unknown[] = [];
  terminated = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage(job: unknown): void {
    this.posted.push(job);
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** A document that keeps its listeners, so a test can fire gestures and visibility changes. */
export class FakeDoc {
  visibilityState: 'visible' | 'hidden' = 'visible';
  readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  fire(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
}

/** The samples a render of `job` gives here: each sound its own length, so a test can tell
 *  which buffer a source plays. */
export function samplesFor(job: RenderJob): Float32Array {
  if (job.kind === 'sfx') return new Float32Array(100 + SFX_IDS.indexOf(job.id));
  return new Float32Array(job.id === 'workshop' ? 4000 : 5000);
}

/** A game audio attached to a fake page, with `window` and `Worker` stubbed (undo with
 *  vi.unstubAllGlobals). The context exists only after `tap()`. */
export function setupAudio(win: object = { AudioContext: FakeContext }, worker: unknown = FakeWorker) {
  vi.stubGlobal('window', win);
  vi.stubGlobal('Worker', worker);
  const doc = new FakeDoc();
  const audio = new GameAudio();
  audio.attach(doc as unknown as Document);
  const tap = (type = 'pointerdown'): void => doc.fire(type);
  return { audio, doc, tap };
}

/** The context's two buses, made in this order after the compressor: effects, wet, music. */
export function buses(ctx: FakeContext): { sfx: FakeGain; music: FakeGain } {
  const [sfx, , music] = ctx.of('gain') as FakeGain[];
  return { sfx, music };
}

/** Answers the worker's jobs (those `pick` keeps) as a real one would. */
export function answer(w: FakeWorker, pick: (j: RenderJob) => boolean = () => true): void {
  for (const j of w.posted as RenderJob[]) if (pick(j)) w.onmessage?.({ data: { ...j, data: samplesFor(j) } });
}

/** The latest value scheduled on a param. */
export const last = (p: FakeParam): number | undefined => p.calls[p.calls.length - 1]?.[1];

/** Lets the context's resume/suspend promises settle. */
export const settle = (): Promise<void> => new Promise((r) => queueMicrotask(r));
