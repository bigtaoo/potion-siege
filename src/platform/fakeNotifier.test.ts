// The dev stand-in for the iOS reminders (?notify=fake): its sheet says yes after a moment and
// its bookings go to the console.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devNotifier, fakeNotifier } from './fakeNotifier';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the fake notifier', () => {
  it('comes only with ?notify=fake', () => {
    expect(devNotifier('?notify=fake')).not.toBeNull();
    expect(devNotifier('')).toBeNull();
    expect(devNotifier('?notify=real')).toBeNull();
  });

  it('says yes a moment after the sheet comes up, and tells the settings', async () => {
    vi.useFakeTimers();
    const n = fakeNotifier();
    let changed = 0;
    n.onChange = () => changed++;
    expect(n.status()).toBe('unknown');
    const answer = n.ask();
    expect(n.status()).toBe('unknown');
    await vi.advanceTimersByTimeAsync(400);
    await expect(answer).resolves.toBe('on');
    expect(n.status()).toBe('on');
    expect(changed).toBe(1);
  });

  it('logs its bookings and cancellations', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const n = fakeNotifier();
    n.schedule('gift', 0, 'A gift', 'Claim it');
    n.cancel('daily');
    expect(log.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['reminder', 'gift'],
      ['reminder off', 'daily'],
    ]);
  });
});
