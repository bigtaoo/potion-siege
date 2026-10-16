// The home screen's nudges, as plain rules over the save: which tabs get a red dot, when the
// daily challenge starts showing, and the stage the codex quotes an enemy's numbers for.

import { heroCost, heroUnlocked, WORKSHOP_IDS, workshopCost, type MetaSave } from '../sim/meta';
import { HERO_KINDS, type EnemyKind } from '../sim/types';
import { FIRST_STAGE } from '../sim/waves';

/** Some unlocked potion can level up with the crystals at hand. */
export function canUpgradePotion(m: MetaSave): boolean {
  return HERO_KINDS.some((k) => {
    const cost = heroCost(m.heroes[k]);
    return heroUnlocked(m, k) && cost !== null && cost <= m.crystals;
  });
}

/** Some workshop upgrade is affordable. */
export function canUpgradeWorkshop(m: MetaSave): boolean {
  return WORKSHOP_IDS.some((id) => {
    const cost = workshopCost(id, m.workshop[id]);
    return cost !== null && cost <= m.crystals;
  });
}

/** Stages to clear before the daily challenge is offered: by then the player has merged,
 *  picked skills and met a new enemy kind, and the challenge (two stages past the furthest one
 *  won) is a stretch rather than a wall. */
export const CHALLENGE_AFTER = 3;

/** The daily challenge is offered: enough stages won, or it was played already (a save from
 *  before the gate keeps it). */
export function challengeOpen(m: MetaSave): boolean {
  return m.cleared >= CHALLENGE_AFTER || m.challenge.date !== '';
}

/** The battle tab shows today's challenge: once it is open, or while one of today's tasks asks
 *  for it, so that task can always be done. */
export function challengeShown(m: MetaSave): boolean {
  return challengeOpen(m) || m.daily.tasks.some((task) => task.id === 'challenge' && !task.claimed);
}

/** The stage the codex quotes a kind's numbers for: the picked one, or the first it comes on
 *  when that is later. */
export function codexStage(kind: EnemyKind, stage: number): number {
  return Math.max(stage, FIRST_STAGE[kind]);
}
