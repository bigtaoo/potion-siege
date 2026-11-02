// The home screens between `npm run onboard`'s battles (onboard.test.ts): the fake player taps
// whatever the home guide points at, REACT seconds after each screen is built, until it points at
// the start button (or at nothing, when the player then taps start by itself). It counts the taps,
// the guide's steps by how they ended, and any pointing at a button the screen did not draw.
import type { Container } from 'pixi.js';
import type { Game } from '../src/app';
import { guideAim } from '../src/game/homeGuide';
import { home } from '../src/game/homeScreen';
import type { World } from '../src/game/testWorld';
import { gameDay } from '../src/sim/daily';

/** Taps on one home screen before the player gives up on the guide and taps start. */
const MOST_TAPS = 30;

export interface Visit {
  /** Taps the guide asked for, the start button's included. */
  taps: number;
  /** The guide's steps this visit, by how they ended (done, none, other, skipped). */
  steps: Record<string, number>;
  /** Pointings at a button not on the screen. */
  lost: number;
  /** Whether the guide ended at the start button by itself. */
  toStart: boolean;
}

const page = (g: Game): Container => g['menu'].children[0];
const press = (g: Game, label: string): boolean => {
  const b = page(g)?.getChildByLabel(label, true);
  b?.emit('pointertap', { stopPropagation() {} } as never);
  return !!b;
};

/** The home screen after a battle, followed as pointed, ending in the next battle. */
export function homeVisit(w: World): Visit {
  const g = w.game;
  const before = w.events('guide_step').length;
  g['tab'] = 'battle';
  home(g);
  let taps = 0;
  let lost = 0;
  let toStart = false;
  while (g['menu'].visible && taps < MOST_TAPS) {
    const aim = guideAim(g, g['panel'], g['tab'], gameDay(g.save, new Date()));
    if (!aim?.target) break;
    taps++;
    if (aim.target === 'start') toStart = true;
    if (!press(g, aim.target)) {
      lost++;
      break;
    }
  }
  // the guide done (or lost): the player starts the battle by itself
  if (g['menu'].visible) {
    g['tab'] = 'battle';
    g['panel'] = null;
    home(g);
    press(g, 'start');
  }
  const steps: Record<string, number> = {};
  for (const e of w.events('guide_step').slice(before)) steps[String(e.result)] = (steps[String(e.result)] ?? 0) + 1;
  return { taps, steps, lost, toStart };
}
