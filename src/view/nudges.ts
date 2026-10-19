// The home screen's nudges, as plain rules over the save: which tabs get a red dot, when the
// daily challenge starts showing, and the stage the codex quotes an enemy's numbers for.

import { nextTier, TRACK_IDS, trackReady } from '../sim/achievements';
import { CHAPTER_COUNT, chestWaiting } from '../sim/chapters';
import { chestReady, heroCost, heroUnlocked, maxStage, unlockPrice, WORKSHOP_IDS, workshopCost, type MetaSave, type SeenTab } from '../sim/meta';
import { HERO_KINDS, LINEUP, type EnemyKind, type HeroKind } from '../sim/types';
import { FIRST_STAGE } from '../sim/waves';

// The red dots. A dot means "something here can be claimed or bought right now" and, past the
// daily claims, only once: the potions tab while one of the four fielded potions can level up
// (the core loop, so it stays lit) or a new potion has joined the reserve; the workshop, codex
// and shop tabs once for each new thing they offer (an upgrade level that became affordable, an
// achievement tier reached, today's chest, a potion for sale) until that tab has been open; the
// battle tab while a chapter chest waits. A mid-game home then shows one or two at a time.

/** One of the four fielded potions can level up with the crystals at hand. */
export function canUpgradeLineup(m: MetaSave): boolean {
  return m.lineup.some((k) => {
    const cost = heroCost(m.heroes[k]);
    return cost !== null && cost <= m.crystals;
  });
}

/** What a tab's dot can be about, a key each: the things there to claim or buy now, or with
 *  `ready` false every one that could come up as things stand (a key outside those is stale). */
export function dotKeys(m: MetaSave, tab: SeenTab, today: string, ready = true): string[] {
  if (tab === 'potions') return HERO_KINDS.filter((k) => !LINEUP.includes(k) && (!ready || heroUnlocked(m, k))).map((k) => `new:${k}`);
  if (tab === 'workshop') {
    return WORKSHOP_IDS.filter((id) => {
      const cost = workshopCost(id, m.workshop[id]);
      return cost !== null && (!ready || cost <= m.crystals);
    }).map((id) => `${id}:${m.workshop[id]}`);
  }
  if (tab === 'codex') return TRACK_IDS.filter((id) => (ready ? trackReady(m, id) : nextTier(m, id) !== null)).map((id) => `${id}:${nextTier(m, id)}`);
  const chest = !ready || chestReady(m, today) ? [`chest:${today}`] : [];
  const unlocks = HERO_KINDS.filter((k) => {
    const price = unlockPrice(k);
    return price !== null && !heroUnlocked(m, k) && (!ready || price <= m.crystals);
  });
  return [...chest, ...unlocks.map((k) => `unlock:${k}`)];
}

/** The tab offers something it has not offered while it was open. */
export function newOnTab(m: MetaSave, tab: SeenTab, today: string): boolean {
  const seen = m.seen[tab] ?? [];
  return dotKeys(m, tab, today).some((k) => !seen.includes(k));
}

/** The tab is open: what it offers now is seen, and keys that can no longer come up are
 *  dropped. True when that changed the save. */
export function markSeen(m: MetaSave, tab: SeenTab, today: string): boolean {
  const old = m.seen[tab] ?? [];
  const could = new Set(dotKeys(m, tab, today, false));
  const next = [...new Set([...old.filter((k) => could.has(k)), ...dotKeys(m, tab, today)])];
  if (next.length === old.length && next.every((k, i) => k === old[i])) return false;
  m.seen[tab] = next;
  return true;
}

/** A chapter's one-time chest waits to be opened. */
export function anyChestWaiting(m: MetaSave): boolean {
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) if (chestWaiting(m, ch)) return true;
  return false;
}

/** The nav bar's dots, tab by tab (the tab already open gets none). */
export function navDots(m: MetaSave, today: string): Record<SeenTab | 'battle', boolean> {
  return {
    potions: canUpgradeLineup(m) || newOnTab(m, 'potions', today),
    workshop: newOnTab(m, 'workshop', today),
    codex: newOnTab(m, 'codex', today),
    shop: newOnTab(m, 'shop', today),
    battle: anyChestWaiting(m),
  };
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
