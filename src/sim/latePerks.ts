// The milestones past Lv 20: every potion gets four more perks on its way to the level cap, so the
// long climb from 20 to 40 has something to aim at besides a few percent of damage. Kept small:
// the stage curve was tuned without them (scripts/guard), and they only reach the potions levelled
// that far.

import type { HeroKind } from './types';

/** The steps, by the level that opens them. sharp / keen: the potion's own damage; deep: its
 *  Lv 10 perk once more at half strength; aura: every potion's damage, once. */
export const LATE_STEPS = [
  { level: 25, step: 'sharp' },
  { level: 30, step: 'deep' },
  { level: 35, step: 'keen' },
  { level: 40, step: 'aura' },
] as const;
export type LateStep = (typeof LATE_STEPS)[number]['step'];
export type LatePerkId = `${HeroKind}${Capitalize<LateStep>}`;

/** The numbers, here and not in balance.json so the stage curve's tuning stays its own. */
export const LATE = {
  /** Multipliers on the potion's own damage at Lv 25 and Lv 35. */
  sharp: 0.03,
  keen: 0.04,
  /** The Lv 10 perk's bonus applied again at this share. */
  deep: 0.5,
  /** Multiplier on every potion's damage once one potion is at Lv 40. */
  aura: 0.03,
} as const;

const cap = (step: LateStep) => `${step[0].toUpperCase()}${step.slice(1)}`;

export function latePerk(kind: HeroKind, step: LateStep): LatePerkId {
  return `${kind}${cap(step)}` as LatePerkId;
}

/** The potion and the step a late perk is for, null for any other perk. */
export function lateStepOf(id: string): { kind: HeroKind; step: LateStep } | null {
  for (const { step } of LATE_STEPS) {
    const tail = cap(step);
    if (id.endsWith(tail) && id.length > tail.length) return { kind: id.slice(0, -tail.length) as HeroKind, step };
  }
  return null;
}

/** Damage multiplier the late perks give one potion: its own sharp and keen, and the aura once
 *  any potion reaches Lv 40 (it does not stack, so a bench of maxed potions adds nothing). */
export function lateDamage(perks: ReadonlySet<string>, kind: HeroKind): number {
  let own = 1;
  if (perks.has(latePerk(kind, 'sharp'))) own *= 1 + LATE.sharp;
  if (perks.has(latePerk(kind, 'keen'))) own *= 1 + LATE.keen;
  const aura = [...perks].some((id) => lateStepOf(id)?.step === 'aura');
  return own * (aura ? 1 + LATE.aura : 1);
}

/** How many times a potion's Lv 10 perk counts: 0 without it, 1 with it, 1.5 with deep too. */
export function perkWeight(perks: ReadonlySet<string>, base: string, kind: HeroKind): number {
  if (!perks.has(base)) return 0;
  return 1 + (perks.has(latePerk(kind, 'deep')) ? LATE.deep : 0);
}
