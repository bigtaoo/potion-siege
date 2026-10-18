import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedEvent } from './analytics';
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

  /** The events in the n-th beacon's body. */
  async function beaconed(n: number): Promise<TrackedEvent[]> {
    const [url, blob] = sendBeacon.mock.calls[n];
    expect(url).toBe(COLLECTOR);
    expect(blob.type).toBe('text/plain');
    return JSON.parse(await blob.text()) as TrackedEvent[];
  }

  it('holds events until the queue reaches 50, then sends them in one beacon', async () => {
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(49));
    expect(sendBeacon).not.toHaveBeenCalled();
    sink.send(events(1, 49));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const sent = await beaconed(0);
    expect(sent).toHaveLength(50);
    expect(sent[49]).toEqual(ev(49));

    // the queue starts over
    sink.send(events(10, 50));
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends whatever is queued on every interval tick', async () => {
    const sink = new BeaconSink(COLLECTOR, 1000);
    sink.send(events(3));
    vi.advanceTimersByTime(999);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(await beaconed(0)).toEqual(events(3));

    sink.send(events(2, 3));
    vi.advanceTimersByTime(1000);
    expect(await beaconed(1)).toEqual(events(2, 3));
  });

  it('defaults to a 15 s interval', () => {
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(1));
    vi.advanceTimersByTime(14_999);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the queue is empty', () => {
    const sink = new BeaconSink(COLLECTOR, 1000);
    sink.flush();
    vi.advanceTimersByTime(5000);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to a keepalive fetch when the beacon is refused', () => {
    sendBeacon.mockReturnValue(false);
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(2));
    sink.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(COLLECTOR);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, mode: 'no-cors' });
    expect(JSON.parse(init.body as string)).toEqual(events(2));
  });

  it('falls back to fetch when the browser has no sendBeacon', () => {
    vi.stubGlobal('navigator', {});
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(1));
    sink.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(events(1));
  });

  it('swallows a failed fallback fetch', async () => {
    vi.stubGlobal('navigator', {});
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));
    const sink = new BeaconSink(COLLECTOR);
    sink.send(events(1));
    expect(() => sink.flush()).not.toThrow();
    await Promise.resolve(); // let the rejection reach its catch, or vitest reports it unhandled
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
