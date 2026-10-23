// What a frame that throws leads to (the Game's ticker listener and the quality loop both hand it
// here): reported as an `anomaly` (rate-limited, FaultGuard), then a battle in progress is
// settled as lost and the home screen is put up afresh, so one bad frame never leaves a frozen
// canvas. Recoveries that keep failing reload the page, at most once per RESTART_GAP_MS.

import type { Game } from '../app';
import { finish } from './ending';
import { FaultGuard, markRestart, restartedLately } from './faultGuard';
import { home } from './homeScreen';

/** The fault handler for `g`; never throws. */
export function faultHandler(g: Game, reload: () => void = () => globalThis.location.reload()): (err: unknown) => void {
  const guard = new FaultGuard(Date.now, () => !restartedLately());
  return (err) => {
    const { report, act } = guard.fault();
    if (report) {
      console.error(err);
      g.perf.anomalies.error(err);
    }
    if (act === 'wait') return;
    if (act === 'restart') {
      markRestart();
      reload();
      return;
    }
    try {
      recover(g);
    } catch (again) {
      // the next fault tries again, and restarts the page once recoveries stop helping
      console.error(again);
    }
  };
}

/** A battle in progress ends as lost (booked like any loss); then home, built anew. */
function recover(g: Game): void {
  const b = g.battle;
  if (g.run && b && !b.result && !g.ended) {
    try {
      b.result = 'lost';
      finish(g, b);
    } catch {
      // a battle too broken to book is left as it is: home replaces it all the same
    }
  }
  g.ask?.close('left');
  g.ask = null;
  home(g);
}
