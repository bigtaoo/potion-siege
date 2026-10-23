import { describe, expect, it } from 'vitest';
import { newMeta, type MetaSave } from './meta';
import { awake, offerReminders, reminders } from './reminders';
import { BALANCE } from './types';
import { WELCOME_GIFTS } from './welcome';

const R = BALANCE.reminders;
// 2026-10-22 10:00 UTC; Berlin is UTC+2 then (offset -120), New York UTC-4 (offset 240)
const NOW = Date.UTC(2026, 9, 22, 10);
const BERLIN = -120;

function player(over: (m: MetaSave) => void = () => {}): MetaSave {
  const m = newMeta();
  m.runs = 5;
  m.welcome.gifts = WELCOME_GIFTS.length;
  over(m);
  return m;
}

describe('reminders', () => {
  it('keeps the night quiet, across midnight on either side', () => {
    expect(awake(Date.UTC(2026, 9, 22, 21), 0)).toBe(Date.UTC(2026, 9, 22, 21));
    expect(awake(Date.UTC(2026, 9, 22, 23), 0)).toBe(Date.UTC(2026, 9, 23, R.quietTo));
    expect(awake(Date.UTC(2026, 9, 23, 3), 0)).toBe(Date.UTC(2026, 9, 23, R.quietTo));
    // 23:00 in Berlin is 21:00 UTC: it waits for 08:00 there
    expect(awake(Date.UTC(2026, 9, 22, 21), BERLIN)).toBe(Date.UTC(2026, 9, 23, R.quietTo - 2));
  });

  it('rings the challenge in the evening, skipping a played one and one too close to now', () => {
    expect(reminders(newMeta(), true, NOW, 0)).toEqual([]);
    expect(reminders(player(), false, NOW, 0)).toEqual([]);
    const evening = (d: number, off = 0) => [{ id: 'daily', at: Date.UTC(2026, 9, d, R.dailyHour) + off * 60_000 }];
    expect(reminders(player(), true, NOW, 0)).toEqual(evening(22));
    // played today's: tomorrow's
    expect(reminders(player((m) => (m.challenge.date = '2026-10-22')), true, NOW, 0)).toEqual(evening(23));
    // open in the late afternoon: too soon, so tomorrow's
    expect(reminders(player(), true, Date.UTC(2026, 9, 22, R.dailyHour - 1), 0)).toEqual(evening(23));
    // days are the phone's own: in New York it is still the 22nd at 10:00 UTC
    expect(reminders(player((m) => (m.challenge.date = '2026-10-22')), true, NOW, 240)).toEqual(evening(23, 240));
  });

  it('turns over the month and the year by the phone day', () => {
    const m = player((p) => {
      p.welcome.gifts = 1;
      p.welcome.day = '2026-12-31';
    });
    expect(reminders(m, true, Date.UTC(2026, 11, 31, 10), 0)).toEqual([{ id: 'gift', at: Date.UTC(2027, 0, 1, R.dailyHour) }]);
    m.welcome.day = '2028-02-28';
    expect(reminders(m, true, Date.UTC(2028, 1, 28, 10), 0)).toEqual([{ id: 'gift', at: Date.UTC(2028, 1, 29, R.dailyHour) }]);
  });

  it('rings the next welcome gift instead while the week runs', () => {
    const m = player((p) => {
      p.welcome.gifts = 2;
      p.welcome.day = '2026-10-22';
    });
    expect(reminders(m, true, NOW, 0)).toEqual([{ id: 'gift', at: Date.UTC(2026, 9, 23, R.dailyHour) }]);
    m.welcome.day = '2026-10-21';
    expect(reminders(m, true, NOW, 0)).toEqual([{ id: 'gift', at: Date.UTC(2026, 9, 22, R.dailyHour) }]);
  });

  it('is offered once, after a few runs, while the system has not been asked', () => {
    const runs = R.askAfterRuns;
    expect(offerReminders(player((m) => (m.runs = runs - 1)), 'unknown', false)).toBe(false);
    expect(offerReminders(player((m) => (m.runs = runs)), 'unknown', false)).toBe(true);
    expect(offerReminders(player((m) => (m.runs = runs)), 'unknown', true)).toBe(false);
    expect(offerReminders(player((m) => (m.runs = runs)), 'off', false)).toBe(false);
  });
});
