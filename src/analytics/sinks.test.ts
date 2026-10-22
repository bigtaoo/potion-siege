import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedEvent } from './analytics';
import { BATCH_BYTES, EVENT_BYTES, batches } from './batches';
import { BeaconSink, ConsoleSink, MemorySink } from './sinks';

const COLLECTOR = 'https://collector.test/e';

function ev(i: number): TrackedEvent {
  return { name: `e${i}`, uid: 'u', sid: 's', ts: i, day: 0, session: 1, build: 'b', platform: 'web', src: 'direct', props: { i } };
}

const events = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ev(from + i));

describe('MemorySink', () => {
  it('keeps only the last 500 events', () => {
    const sink = new MemorySink();
    sink.send(events(450));
    sink.send(events(100, 450));
    expect(sink.events).toHaveLength(500);
    expect(sink.events[0].name).toBe('e50');
    expect(sink.events[499].name).toBe('e549');
  });
});

describe('ConsoleSink', () => {
  it('logs one line per event', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    new ConsoleSink().send(events(2));
    expect(debug).toHaveBeenCalledTimes(2);
    expect(debug.mock.calls[0][0]).toBe('[track] e0');
    debug.mockRestore();
  });
});

describe('BeaconSink', () => {
  let sendBeacon: ReturnType<typeof vi.fn<(url: string, data: Blob) => boolean>>;
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<unknown>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    sendBeacon = vi.fn(() => true);
    fetchMock = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** The events in the n-th fetch's body, which must be a plain POST. */
  function posted(n: number): TrackedEvent[] {
    const [url, init] = fetchMock.mock.calls[n];
    expect(url).toBe(COLLECTOR);
    expect(init).toEqual({ method: 'POST', body: expect.any(String), mode: 'no-cors' });
    return JSON.parse(init.body as string) as TrackedEvent[];
  }

  /** The events in the n-th beacon's body. */
  async function beaconed(n: number): Promise<TrackedEvent[]> {
    const [url, blob] = sendBeacon.mock.calls[n];
    expect(url).toBe(COLLECTOR);
    expect(blob.type).toBe('text/plain');
    return JSON.parse(await blob.text()) as TrackedEvent[];
  }

  it('holds events until the queue reaches 50, then posts them with a plain fetch', () => {
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(49));
    expect(fetchMock).not.toHaveBeenCalled();
    sink.send(events(1, 49));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(posted(0)).toEqual(events(50));

    // the queue starts over, and nothing went by beacon
    sink.send(events(10, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('posts whatever is queued on every interval tick, 15 s by default', () => {
    const sink = new BeaconSink(COLLECTOR, 1000);
    sink.send(events(3));
    vi.advanceTimersByTime(999);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(posted(0)).toEqual(events(3));
    sink.send(events(2, 3));
    vi.advanceTimersByTime(1000);
    expect(posted(1)).toEqual(events(2, 3));

    const slow = new BeaconSink(COLLECTOR);
    slow.send(events(1));
    vi.advanceTimersByTime(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('posts 1000 held events released at once whole, in requests the collector takes', () => {
    const sink = new BeaconSink(COLLECTOR);
    const held = events(1000).map((e) => ({ ...e, props: { i: e.props.i, pad: 'x'.repeat(600) } }));
    sink.send(held);
    const bodies = fetchMock.mock.calls.map(([, init]) => init.body as string);
    expect(bodies.length).toBeGreaterThan(20);
    for (const b of bodies) expect(new TextEncoder().encode(b).length).toBeLessThanOrEqual(BATCH_BYTES);
    expect(bodies.flatMap((b) => JSON.parse(b) as TrackedEvent[])).toEqual(held);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('sends nothing when the queue is empty', () => {
    const sink = new BeaconSink(COLLECTOR, 1000);
    sink.flush();
    vi.advanceTimersByTime(5000);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flush beacons batch by batch when the page is going away', async () => {
    const sink = new BeaconSink(COLLECTOR);
    // under 50, so no post took them
    for (let i = 0; i < 49; i++) sink.send(events(1, i));
    sink.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(await beaconed(0)).toEqual(events(49));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a refused beacon tries a keepalive fetch and keeps the rest queued for the next tick', async () => {
    const sink = new BeaconSink(COLLECTOR, 1000);
    const big = events(49).map((e) => ({ ...e, props: { i: e.props.i, pad: 'x'.repeat(1500) } }));
    for (const e of big) sink.send([e]);
    sendBeacon.mockReturnValueOnce(true).mockReturnValueOnce(false);
    sink.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    const first = await beaconed(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', keepalive: true, mode: 'no-cors' });
    const second = JSON.parse(init.body as string) as TrackedEvent[];

    // the page was only hidden: the tick posts what the beacons did not take
    vi.advanceTimersByTime(1000);
    const rest = fetchMock.mock.calls.slice(1).flatMap((_, n) => posted(n + 1));
    expect([...first, ...second, ...rest]).toEqual(big);
  });

  it('flushes with a keepalive fetch when the browser has no sendBeacon', () => {
    vi.stubGlobal('navigator', {});
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(1));
    sink.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(events(1));
  });

  it('swallows a failed fetch', async () => {
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));
    const sink = new BeaconSink(COLLECTOR);
    expect(() => sink.send(events(50))).not.toThrow();
    await Promise.resolve(); // let the rejection reach its catch, or vitest reports it unhandled
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('batches', () => {
  it('cuts at 50 events and at the byte limit, keeping the order', () => {
    expect(batches(events(120)).map((b) => (JSON.parse(b) as unknown[]).length)).toEqual([50, 50, 20]);
    const wide = events(30).map((e) => ({ ...e, props: { s: 'é'.repeat(1800) } }));
    const bodies = batches(wide);
    for (const b of bodies) expect(new TextEncoder().encode(b).length).toBeLessThanOrEqual(BATCH_BYTES);
    expect(bodies.flatMap((b) => JSON.parse(b) as TrackedEvent[])).toEqual(wide);
    expect(batches([])).toEqual([]);
  });

  it('drops an event the collector would drop for its size', () => {
    const huge = { ...ev(1), props: { s: 'x'.repeat(EVENT_BYTES) } };
    expect(batches([ev(0), huge, ev(2)])).toEqual([JSON.stringify([ev(0), ev(2)])]);
  });
});
