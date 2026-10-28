// A scripted stand-in for the host's notifications (platform/types.ts Notifier), for the tests of
// the reminders (reminderBook.test.ts, returnHooks.test.ts): the system's sheet answers as set,
// and what is booked stays readable.

import type { Notifier } from '../platform/types';
import { world, type World } from './testWorld';
import type { MetaSave } from '../sim/meta';

export class Bell implements Notifier {
  now: 'unknown' | 'on' | 'off' = 'unknown';
  /** What the system's sheet answers. */
  answer: 'on' | 'off' = 'on';
  asks = 0;
  booked = new Map<string, { at: number; title: string; body: string }>();
  status(): 'unknown' | 'on' | 'off' {
    return this.now;
  }
  async ask(): Promise<'on' | 'off'> {
    this.asks++;
    this.now = this.answer;
    return this.answer;
  }
  schedule(id: string, at: number, title: string, body: string): void {
    this.booked.set(id, { at, title, body });
  }
  cancel(id: string): void {
    this.booked.delete(id);
  }
}

/** A world whose host has `bell` for its notifications. */
export function bellWorld(save: MetaSave, bell: Bell, switches?: string): World {
  return world(save, (h) => Object.assign(h, { notify: bell }), switches);
}
