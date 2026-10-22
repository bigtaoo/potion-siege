// The dead taken off the field: their gold, the commander's charge, and the bursts the skills set
// off as they die (the fire chain, the melt, the shatter).

import type { Battle } from './battle';
import { corrode, harm, slow, splash } from './damage';
import { FP, pm, ticks, times, toFp } from './math/fixed';
import { within } from './targets';
import { BALANCE, isBoss } from './types';

const B = BALANCE;
const C = B.commander;

export function reapDead(b: Battle): void {
  if (!b.enemies.some((e) => e.hp <= 0)) return;
  // the living move up in place, in order; the dead go to a reused list
  const all = b.enemies;
  const dead = b.dead;
  let n = 0;
  for (const e of all) {
    if (e.hp > 0) all[n++] = e;
    else dead.push(e);
  }
  all.length = n;
  for (const e of dead) {
    const def = B.enemies[e.kind];
    const gold = b.shares.gold((def.gold + b.mods.goldPerKill) * (b.setup.modifiers?.killGold ?? 1) * e.gold, e.heft);
    b.gold += gold;
    b.kills++;
    b.charge = Math.min(C.charge, b.charge + (isBoss(e.kind) ? C.bossCharge : b.shares.charge(e.heft)));
    b.events.push({ type: 'kill', kind: e.kind, x: e.x / FP, y: e.y / FP, gold, boss: isBoss(e.kind) });
    if (b.mods.fireChain && e.scorchTime > 0 && b.shares.proc('fireChain', e.heft)) {
      // burnt to death: it bursts once more (the blast itself does not count as fire, so it
      // cannot set off an endless chain)
      const radius = times(b.fixed.fireRadius, pm(B.skills.fireChainRadius));
      for (const o of b.enemies) if (within(o, e.x, e.y, radius)) harm(b, o, times(times(e.scorch, pm(B.skills.fireChain)), splash(o)), e.scorchBy);
      b.events.push({ type: 'hit', kind: 'fire', x: e.x / FP, y: e.y / FP, radius: radius / FP });
    }
    if (b.mods.melt && e.rust > 0 && b.shares.proc('melt', e.heft)) {
      // died rusted: it falls apart and its rust eats into what stands around it
      const radius = toFp(B.skills.meltRadius);
      for (const o of b.enemies) if (within(o, e.x, e.y, radius)) corrode(b, o, 0, o.kind === 'flyer' ? Math.ceil(e.rust * B.flyer.splash) : e.rust);
      b.events.push({ type: 'hit', kind: 'poison', x: e.x / FP, y: e.y / FP, radius: B.skills.meltRadius });
    }
    if (b.mods.shatter && (e.freezeTime > 0 || e.slowTime > 0)) {
      // died frozen (or only chilled, for fewer shards): it shatters into shards that cut and
      // chill what stands around it
      const radius = toFp(B.skills.shatterRadius);
      const part = pm(e.freezeTime > 0 ? B.skills.shatter : B.skills.shatterChill);
      for (const o of b.enemies) {
        if (!within(o, e.x, e.y, radius)) continue;
        harm(b, o, times(times(e.maxHp, part), splash(o)), 'ice');
        // only a frozen one chills them: chilled shards that chill would chain through a crowd
        if (e.freezeTime > 0) slow(o, B.heroes.ice.slow, ticks(B.heroes.ice.slowTime));
      }
      b.events.push({ type: 'hit', kind: 'ice', x: e.x / FP, y: e.y / FP, radius: B.skills.shatterRadius });
    }
  }
  dead.length = 0;
}
