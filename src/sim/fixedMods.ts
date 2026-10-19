// The skill and perk multipliers of a battle in the integer form its sim uses (battle.ts),
// worked out again on every pick.

import { FP, pm, times } from './math/fixed';
import type { BattleSetup } from './meta';
import type { Mods } from './skills';
import { BALANCE as B, type HeroKind } from './types';

/** The skill and perk multipliers in integer form, worked out again on every pick. */
export interface Fixed {
  /** The shot damage of each kind at each level, in FP. */
  damage: Record<HeroKind, number[]>;
  /** The poison a corrosion hit leaves at each level, in FP a second. */
  poison: number[];
  /** Thousandths of a tick off the cooldown per tick: every hero, and a wind hero. */
  speed: number;
  windSpeed: number;
  crit: number;
  fireRadius: number;
  burn: number;
  mark: number;
  freezeChance: number;
  freezeTime: number;
  static: number;
  plasmaBurn: number;
  rustStep: number;
  push: number;
}

export function fixedMods(m: Mods, setup: BattleSetup): Fixed {
  const damage = {} as Record<HeroKind, number[]>;
  for (const [k, h] of Object.entries(B.heroes) as [HeroKind, { damage: number }][]) {
    damage[k] = B.starDamage.map((s) => Math.round(h.damage * s * m.damage(k) * setup.heroDamage[k] * FP));
  }
  const speed = pm(m.speed);
  return {
    damage,
    poison: B.starDamage.map((s) => Math.round(B.heroes.poison.poisonDps * s * m.damage('poison') * setup.heroDamage.poison * FP)),
    speed,
    windSpeed: times(speed, pm(m.windSpeed)),
    crit: pm(m.crit + (setup.modifiers?.crit ?? 0)),
    fireRadius: Math.round(B.heroes.fire.splash * m.fireRadius * FP),
    burn: pm(m.burn),
    mark: pm(m.mark),
    freezeChance: pm(m.freezeChance),
    freezeTime: pm(m.freezeTime),
    static: pm(m.static),
    plasmaBurn: pm(Math.max(m.burn, B.skills.plasmaBurn)),
    rustStep: pm(m.rustStep),
    push: pm(m.push),
  };
}
