// The enemies' tick: poison and burns, statuses wearing off, the flyer's weave, the whirlwinds'
// pull, the winder's and the bosses' timers, the march down to the wall and the bite out of it.

import type { Battle } from './battle';
import { brood, hop, rewind, slam } from './bosses';
import { harm } from './damage';
import { K } from './field';
import { pull } from './hits';
import { FP, muldiv, TICK_RATE, ticks, times, toFp } from './math/fixed';
import { sinB, TRIG_ONE } from './math/trig';
import { spawn } from './spawn';
import { frontY } from './targets';
import { BALANCE, isBoss } from './types';

const B = BALANCE;

export function stepEnemies(b: Battle): void {
  let hitWall = false;
  const front = frontY(b);
  for (const v of b.vortices) v.time--;
  b.vortices = b.vortices.filter((v) => v.time > 0);
  for (const e of b.enemies) {
    if (e.poisonTime > 0) {
      harm(b, e, Math.trunc(e.poisonDps / TICK_RATE), 'poison');
      if (--e.poisonTime <= 0) e.poisonDps = 0;
    }
    if (e.burnTime > 0) {
      harm(b, e, Math.trunc(e.burnDps / TICK_RATE), e.burnBy);
      if (--e.burnTime <= 0) e.burnDps = 0;
    }
    e.scorchTime = Math.max(0, e.scorchTime - 1);
    e.markTime = Math.max(0, e.markTime - 1);
    e.rustTime = Math.max(0, e.rustTime - 1);
    if (e.rustTime <= 0) e.rust = 0;
    e.chargeTime = Math.max(0, e.chargeTime - 1);
    if (e.chargeTime <= 0) e.charge = 0;
    e.chillTime = Math.max(0, e.chillTime - 1);
    if (e.chillTime <= 0) e.chill = 0;
    e.slowTime = Math.max(0, e.slowTime - 1);
    e.pushTime = Math.max(0, e.pushTime - 1);
    if (e.freezeTime > 0) {
      e.freezeTime--;
      continue;
    }
    if (e.kind === 'flyer' && !e.atWall) {
      // weaves from side to side on the way down; at the wall it hovers where it stopped
      e.x = e.x0! + muldiv(K.weave, sinB(e.phase! + muldiv(b.time, K.weaveRate, TICK_RATE)), TRIG_ONE);
    }
    if (!isBoss(e.kind)) for (const v of b.vortices) pull(e, v);
    if (e.kind === 'winder' && !e.atWall) {
      if (--e.windTime! <= 0) {
        e.windTime = ticks(B.winder.every);
        rewind(b, e);
      }
    }
    if (e.kind === 'clock' && --e.broodTime! <= 0) {
      e.broodTime = ticks(B.bosses.clock.every);
      brood(b, e);
    }
    if (e.kind === 'tripod' && e.shield! <= 0 && --e.shieldTime! <= 0) {
      e.shield = e.shieldMax;
      b.events.push({ type: 'jar', x: e.x / FP, y: e.y / FP, up: true });
    }
    if (e.guardTime) e.guardTime--;
    const wall = b.wallFront(e.x) - e.radius;
    // a winder keeps behind the crowd it winds, and waits for it
    const stop = e.kind === 'winder' && front > -Infinity ? Math.min(wall, Math.max(e.y, front - toFp(B.winder.gap))) : wall;
    if (e.y < stop) {
      const step = e.slowTime > 0 ? times(e.speed, e.slowFactor) : e.speed;
      e.y = Math.min(stop, e.y + (e.kind === 'anvil' ? hop(b, e, step) : step));
    } else if (e.y >= wall) {
      // a cell just built under it pushes it back to the new front
      e.y = wall;
      if (!e.atWall && e.kind === 'anvil') {
        e.leapTime = 0;
        e.hopTime = ticks(B.bosses.anvil.slamFirst);
      }
      e.atWall = true;
      b.wall -= times(K.wallDps[e.kind], e.heft);
      hitWall = true;
      if (e.kind === 'anvil' && --e.hopTime! <= 0) {
        e.hopTime = ticks(B.bosses.anvil.slamEvery);
        slam(b, e);
      }
    }
  }
  if (hitWall) b.events.push({ type: 'wallHit' });
  for (const h of b.hatch) spawn(b, h.s, h);
  b.hatch.length = 0;
}
