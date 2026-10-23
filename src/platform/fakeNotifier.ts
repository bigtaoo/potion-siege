import { urlSwitches } from '../game/switches';
import type { Notifier } from './types';

/** The fake with `?notify=fake` (dev builds only, as every switch but ?lang), else none. */
export function devNotifier(search: string = location.search): Notifier | null {
  return urlSwitches(search).get('notify') === 'fake' ? fakeNotifier() : null;
}

/** Dev stand-in (?notify=fake): the iOS reminders, whose sheet says yes after a moment and whose
 *  bookings go to the console. */
export function fakeNotifier(): Notifier {
  let status: 'unknown' | 'on' | 'off' = 'unknown';
  const n: Notifier = {
    status: () => status,
    ask: () =>
      new Promise((r) =>
        setTimeout(() => {
          status = 'on';
          n.onChange?.();
          r('on');
        }, 400),
      ),
    schedule: (id, at, title, body) => console.info('reminder', id, new Date(at).toString(), title, body),
    cancel: (id) => console.info('reminder off', id),
  };
  return n;
}
