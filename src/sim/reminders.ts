// The iOS app's local reminders (docs/ios.md "Reminders"): a welcome gift waits, or today's
// challenge is open. Pure: from the save, the time and the phone's UTC offset (minutes, as
// Date.getTimezoneOffset gives it) to the reminders to book; game/reminderBook.ts books them
// through the host. One at a time: while the welcome week runs its gift is the reminder, then the
// challenge. Each rings at dailyHour, local time, at least gapHours after the game was last open,
// and never in the quiet hours (quietFrom..quietTo). Offered once, after a few runs, never on the
// first launch. Ported from D:\standing's meta/reminders.ts.

import type { MetaSave } from './meta';
import { BALANCE } from './types';
import { welcomeOn } from './welcome';

export type ReminderId = 'daily' | 'gift';
export const REMINDER_IDS: readonly ReminderId[] = ['daily', 'gift'];

export interface Reminder {
  id: ReminderId;
  /** When it rings, ms since 1970. */
  at: number;
}

const R = BALANCE.reminders;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** The local calendar date of `at` ('2026-10-15'), as daily.ts's dayOf gives it on the phone;
 *  worked out from the day count (H. Hinnant's civil_from_days), since sim/ keeps off Date. */
function localDay(at: number, offsetMin: number): string {
  const z = Math.floor((at - offsetMin * 60_000) / DAY) + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mo = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (mo <= 2 ? 1 : 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)}`;
}

/** What to book now; ids left out are cancelled. `challenge`: today's challenge is open to this
 *  save (view/nudges.ts challengeOpen). */
export function reminders(m: MetaSave, challenge: boolean, now: number, offsetMin: number): Reminder[] {
  if (m.runs < 1) return [];
  if (welcomeOn(m)) {
    // the next gift: the first ring on a day after the last claim
    const at = ringAt(now, offsetMin, (day) => day > m.welcome.day);
    return at === null ? [] : [{ id: 'gift', at }];
  }
  if (!challenge) return [];
  // the challenge: the first ring on a day it has not been played
  const at = ringAt(now, offsetMin, (day) => day !== m.challenge.date);
  return at === null ? [] : [{ id: 'daily', at }];
}

/** The first dailyHour, gapHours or more from now, on a local day `ok` takes; null when none in three days. */
export function ringAt(now: number, offsetMin: number, ok: (day: string) => boolean): number | null {
  const shift = offsetMin * 60_000;
  const today = Math.floor((now - shift) / DAY) * DAY;
  for (let k = 0; k < 3; k++) {
    const at = awake(today + k * DAY + R.dailyHour * HOUR + shift, offsetMin);
    if (at >= now + R.gapHours * HOUR && ok(localDay(at, offsetMin))) return at;
  }
  return null;
}

/** `at`, or the end of the quiet hours it falls in. */
export function awake(at: number, offsetMin: number): number {
  const shift = offsetMin * 60_000;
  const local = at - shift;
  const day = Math.floor(local / DAY) * DAY;
  const hour = (local - day) / HOUR;
  if (hour >= R.quietFrom) return day + DAY + R.quietTo * HOUR + shift;
  if (hour < R.quietTo) return day + R.quietTo * HOUR + shift;
  return at;
}

/** Whether to offer reminders now: the system has not answered, never asked, and a few runs in. */
export function offerReminders(m: MetaSave, status: 'unknown' | 'on' | 'off', asked: boolean): boolean {
  return status === 'unknown' && !asked && m.runs >= R.askAfterRuns;
}
