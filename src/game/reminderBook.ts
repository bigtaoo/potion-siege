// The iOS app's reminders (sim/reminders.ts) between the home screen and the host's notifications:
// booked again whenever the home screen opens and whenever the game goes to the background,
// offered once by a card over the home screen after a battle (never on a launch), and switched in
// settings. The system's sheet comes only from a tap on that card or on the switch. What the
// player said stays on the device (platform storage), not in the save. Ported from D:\standing's
// ui/reminders.ts.

import type { Game } from '../app';
import { t } from '../i18n';
import type { Notifier } from '../platform/types';
import { offerReminders, REMINDER_IDS, reminders, type ReminderId } from '../sim/reminders';
import { challengeOpen } from '../view/nudges';

/** The device's answer: reminders wanted, and whether the card was answered. */
const KEY = 'ps.reminders';

export type ReminderState = 'on' | 'off' | 'blocked';

export class ReminderBook {
  private readonly launchRuns: number;
  /** The card came up on this launch; it does not come back until the next. */
  private shown = false;

  constructor(private readonly g: Game, private readonly notify: Notifier) {
    this.launchRuns = g.save.runs;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.sync();
    });
  }

  private load(): { on: boolean; asked: boolean } {
    try {
      const r = JSON.parse(this.g.platform.storage.getItem(KEY) ?? '{}') as { on?: unknown; asked?: unknown } | null;
      return { on: r?.on !== false, asked: r?.asked === true };
    } catch {
      return { on: true, asked: false };
    }
  }

  private keep(on: boolean): void {
    this.g.platform.storage.setItem(KEY, JSON.stringify({ on, asked: true }));
  }

  /** Books what is due from now and cancels the rest. */
  sync(now = Date.now()): void {
    const m = this.g.save;
    const due = this.load().on && this.notify.status() === 'on' ? reminders(m, challengeOpen(m), now, new Date(now).getTimezoneOffset()) : [];
    for (const id of REMINDER_IDS) {
      const r = due.find((d) => d.id === id);
      if (!r) this.notify.cancel(id);
      else this.notify.schedule(id, r.at, ...text(id));
    }
  }

  /** Whether the card comes up now: a battle played since launch, a few runs in, never answered,
   *  and not up already on this launch. True marks it as up. */
  offer(): boolean {
    if (this.shown || this.g.autoplay || this.g.save.runs <= this.launchRuns) return false;
    if (!offerReminders(this.g.save, this.notify.status(), this.load().asked)) return false;
    this.shown = true;
    return true;
  }

  /** The card's answer; yes brings up the system's sheet. */
  async answer(yes: boolean): Promise<void> {
    this.keep(yes);
    if (yes) await this.notify.ask();
    this.sync();
  }

  /** The switch: 'blocked' when refused in the phone's settings, which only those can undo. */
  state(): ReminderState {
    const status = this.notify.status();
    if (status === 'off') return 'blocked';
    return status === 'on' && this.load().on ? 'on' : 'off';
  }

  async set(on: boolean): Promise<void> {
    this.keep(on);
    if (on && this.notify.status() === 'unknown') await this.notify.ask();
    this.sync();
  }
}

const books = new WeakMap<Game, ReminderBook | null>();

/** The game's reminders; null where the host has no notifications. */
export function reminderBook(g: Game): ReminderBook | null {
  let b = books.get(g);
  if (b === undefined) books.set(g, (b = g.platform.notify ? new ReminderBook(g, g.platform.notify) : null));
  return b;
}

/** A reminder's title and text, in the player's language as it is now. */
function text(id: ReminderId): [string, string] {
  if (id === 'gift') return [t('remind.giftTitle'), t('remind.giftBody')];
  return [t('remind.dailyTitle'), t('remind.dailyBody')];
}
