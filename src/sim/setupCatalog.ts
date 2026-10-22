// Every way a battle gets set up, for the invariant tests (setupInvariants, softLock,
// challengeOdds and the game's mode flows) and `npm run sweep`: the story stages, the endless
// run and the daily challenge under each modifier and each pair or triple of them, on saves from
// a brand-new one to a maxed one. Nothing in the game imports it.

import { challengeSetup, challengeStage, MODIFIER_IDS, type Challenge, type ModifierId } from './challenge';
import { endlessSetup } from './endless';
import { battleSetup, buyHero, buyWorkshop, heroCost, newMeta, WORKSHOP_IDS, workshopCost, type BattleSetup, type MetaSave } from './meta';
import { BALANCE, HERO_KINDS, LINEUP, type HeroKind } from './types';

const M = BALANCE.meta;

/** Crystals spent by the median player arriving at each stage, as scripts/guard/saves.ts ARRIVE
 *  (from 21 on the regular player's, 7.2% more a stage). */
const ARRIVE = [0, 0, 290, 560, 865, 1195, 1555, 2330, 2830, 3550, 4755, 5545, 6665, 8250, 10095, 12700, 15380, 20305, 24385, 29600, 35500];
for (let f = 1; ARRIVE.length < 52; f *= 1.072) ARRIVE.push(Math.round((25875 * f) / 5) * 5);

/** A save that has cleared `cleared` stages and spent `budget` crystals on the fielded four and
 *  the workshop, cheapest buy first, as the balance suites buy. */
export function spentSave(cleared: number, budget: number, lineup: readonly HeroKind[] = LINEUP): MetaSave {
  const m = newMeta();
  m.cleared = cleared;
  m.stage = Math.min(M.stageCount, cleared + 1);
  m.runs = cleared;
  m.tutorial = m.upgradeHint = cleared > 0;
  m.unlocked = HERO_KINDS.filter((k) => !LINEUP.includes(k) && (lineup.includes(k) || ((BALANCE.heroes[k] as { unlockStage?: number }).unlockStage ?? 99) <= cleared));
  m.lineup = [...lineup];
  m.crystals = budget;
  for (;;) {
    let best: { cost: number; buy: () => boolean } | null = null;
    for (const k of m.lineup) {
      const c = heroCost(m.heroes[k]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k) };
    }
    for (const id of WORKSHOP_IDS) {
      const c = workshopCost(id, m.workshop[id]);
      if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyWorkshop(m, id) };
    }
    if (!best || m.crystals < best.cost || !best.buy()) break;
  }
  m.crystals = 0;
  return m;
}

/** Every potion at the top level, the workshop out, every stage cleared. */
export function maxedSave(): MetaSave {
  const m = spentSave(M.stageCount, 0);
  for (const k of HERO_KINDS) m.heroes[k] = M.heroMax;
  for (const id of WORKSHOP_IDS) m.workshop[id] = M.workshop[id].max;
  return m;
}

/** Nothing bought but the workshop, all of it at one level. */
export function workshopSave(level: 'zero' | 'max'): MetaSave {
  const m = newMeta();
  for (const id of WORKSHOP_IDS) m.workshop[id] = level === 'max' ? M.workshop[id].max : 0;
  return m;
}

/** The saves the sweeps play: a brand-new one, a player some stages in, a late one and a maxed
 *  one. `fresh` is the "fresh-ish" save the challenge must stay winnable for. */
export const SAVES = {
  new: () => newMeta(),
  fresh: () => spentSave(2, ARRIVE[3]),
  mid: () => spentSave(10, ARRIVE[11]),
  late: () => spentSave(40, ARRIVE[41]),
  maxed: maxedSave,
} as const satisfies Record<string, () => MetaSave>;
export type SaveId = keyof typeof SAVES;

/** The crystals the median player has spent arriving at `stage`. */
export function arrive(stage: number): number {
  return ARRIVE[Math.min(ARRIVE.length - 1, stage)];
}

/** The modifier sets a day can draw: none (the plain challenge, for comparison), each one alone,
 *  every pair (what `challenge.modifiers` = 2 draws) and every triple (in case it goes to 3). */
export function modifierSets(size: 0 | 1 | 2 | 3): ModifierId[][] {
  const out: ModifierId[][] = [];
  const walk = (from: number, picked: ModifierId[]) => {
    if (picked.length === size) {
      out.push(picked);
      return;
    }
    for (let i = from; i < MODIFIER_IDS.length; i++) walk(i + 1, [...picked, MODIFIER_IDS[i]]);
  };
  walk(0, []);
  return out;
}

/** A challenge on `m` with these modifiers, its seed and (under trial) its trial potion. */
export function challengeFor(m: MetaSave, mods: readonly ModifierId[], seed: number, trial: HeroKind = HERO_KINDS[seed % HERO_KINDS.length]): Challenge {
  return { day: 'sweep', seed, stage: challengeStage(m), mods: [...mods], trial: mods.includes('trial') ? trial : null };
}

export interface NamedSetup {
  name: string;
  mode: 'story' | 'endless' | 'challenge';
  save: MetaSave;
  setup: BattleSetup;
  challenge?: Challenge;
}

/** Every story stage on a save. */
export function storySetups(saveName: string, m: MetaSave): NamedSetup[] {
  return Array.from({ length: M.stageCount }, (_, i) => ({ name: `${saveName} stage ${i + 1}`, mode: 'story' as const, save: m, setup: battleSetup(m, i + 1) }));
}

export function endlessFor(saveName: string, m: MetaSave): NamedSetup {
  return { name: `${saveName} endless`, mode: 'endless', save: m, setup: endlessSetup(m) };
}

/** Today's challenge on `m` for every modifier set of these sizes, and every trial potion. */
export function challengeSetups(saveName: string, m: MetaSave, sizes: readonly (0 | 1 | 2 | 3)[] = [0, 1, 2, 3], seed = 1): NamedSetup[] {
  const out: NamedSetup[] = [];
  for (const size of sizes) {
    for (const mods of modifierSets(size)) {
      const trials = mods.includes('trial') ? HERO_KINDS : [HERO_KINDS[0]];
      for (const trial of trials) {
        const c = challengeFor(m, mods, seed, trial);
        const label = mods.length ? mods.join('+') : 'plain';
        out.push({ name: `${saveName} challenge ${label}${c.trial ? ` (${trial})` : ''}`, mode: 'challenge', save: m, setup: challengeSetup(m, c), challenge: c });
      }
    }
  }
  return out;
}

/** Every setup source on every save: what setupInvariants.test.ts checks without playing. */
export function allSetups(): NamedSetup[] {
  const saves: [string, MetaSave][] = [
    ...Object.entries(SAVES).map(([k, f]) => [k, f()] as [string, MetaSave]),
    ['workshop 0', workshopSave('zero')],
    ['workshop max', workshopSave('max')],
  ];
  return saves.flatMap(([name, m]) => [...storySetups(name, m), endlessFor(name, m), ...challengeSetups(name, m)]);
}
