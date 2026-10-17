// The home screen's nudges, as plain rules over the save: which tabs get a red dot, when the
// daily challenge starts showing, and the stage the codex quotes an enemy's numbers for.

import { chestReady, heroCost, heroUnlocked, maxStage, unlockPrice, WORKSHOP_IDS, workshopCost, type MetaSave } from '../sim/meta';
import { HERO_KINDS, type EnemyKind, type HeroKind } from '../sim/types';
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

/** Some locked potion is for sale in the shop and affordable. */
export function canBuyUnlock(m: MetaSave): boolean {
  return HERO_KINDS.some((k) => {
    const price = unlockPrice(k);
    return price !== null && !heroUnlocked(m, k) && price <= m.crystals;
  });
}

/** The shop tab's dot: today's free chest is still shut, or a locked potion can be bought. */
export function shopDot(m: MetaSave, today: string): boolean {
  return chestReady(m, today) || canBuyUnlock(m);
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

/** Stages to clear before a task asking for the challenge brings its banner out early: not
 *  in the first battles, where it offered stage 3 to a Lv1 lineup. */
export const CHALLENGE_TASK_AFTER = 2;

/** The battle tab shows today's challenge: once it is open, or while one of today's tasks asks
 *  for it (after the first stages), so that task can be done. */
export function challengeShown(m: MetaSave): boolean {
  return challengeOpen(m) || (m.cleared >= CHALLENGE_TASK_AFTER && m.daily.tasks.some((task) => task.id === 'challenge' && !task.claimed));
}

/** Runs and stages won before a won stage's result goes home first: until then its big button
 *  is the next stage, so battle 1 leads straight to battles 2 and 3. */
export const NEXT_UNTIL = 3;

/** The result of winning `stage` offers the next stage straight away. */
export function offersNext(m: MetaSave, stage: number): boolean {
  return (m.runs < NEXT_UNTIL || m.cleared < NEXT_UNTIL) && stage < maxStage(m);
}

/** Runs before the daily login opens by itself on the home screen; its button and dot are
 *  there from the start. */
export const LOGIN_AFTER_RUNS = 2;

export function loginPops(m: MetaSave): boolean {
  return m.runs >= LOGIN_AFTER_RUNS;
}

/** The home screen's one-time pointer at a potion upgrade: after a first win, with crystals
 *  for one; the kind it points at is the first such potion. */
export function upgradeHintKind(m: MetaSave): HeroKind | null {
  if (m.upgradeHint || m.cleared < 1) return null;
  return HERO_KINDS.find((k) => {
    const cost = heroCost(m.heroes[k]);
    return heroUnlocked(m, k) && cost !== null && cost <= m.crystals;
  }) ?? null;
}

/** The stage the codex quotes a kind's numbers for: the picked one, or the first it comes on
 *  when that is later. */
export function codexStage(kind: EnemyKind, stage: number): number {
  return Math.max(stage, FIRST_STAGE[kind]);
}
