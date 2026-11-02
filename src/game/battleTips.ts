// The one-time words in the first battles (docs/onboarding-plan.md, sections 4-5): stage 1's boss
// gets the new-enemy card, battle 2's first affordable 强化 says what it brings, battle 3's first
// skill pick says what the 推荐 tag means, and the first won result says what stars are for.
// Each shows once a save, marked in MetaSave.guide with the home guide's steps.

import type { Game } from '../app';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import type { BattleEvent } from '../sim/types';
import { guideMarked } from './homeGuide';

/** Seconds the 强化 line stays up, unless the player taps 强化 first. */
export const TIP_SECONDS = 3;

/** Not in autoplay, nor in the endless run or a challenge (their own rules on screen). */
function story(g: Game, b: Battle | null): b is Battle {
  return !!b && !g.autoplay && !b.setup.endless && !g.challenge;
}

/** Each frame of a battle, after the HUD took the frame's events. */
export function battleTips(g: Game, b: Battle | null, events: BattleEvent[]): void {
  const on = story(g, b);
  const seen = (id: string) => g.save.guide.includes(id as never);
  g.hud.firstBoss = on && b.setup.stage === 1 && !seen('bossCard');
  if (g.hud.firstBoss && events.some((e) => e.type === 'wave' && e.boss)) guideMarked(g, 'bossCard', 'done');
  const words = t('guide.upgrade2');
  if (on && g.save.runs === 1 && !seen('upgrade2') && !b.choices && !b.paused && b.canUpgrade()) {
    g.hud.note(words, TIP_SECONDS);
    guideMarked(g, 'upgrade2', 'done');
  }
  // the skill pick it led to takes it away
  if (b?.choices && g.hud.noted === words) g.hud.note('', 0);
  const pick = on && g.save.runs === 2 && !seen('pickTip');
  if (pick !== !!g.overlay.pickTip) g.overlay.pickTip = pick ? () => pickTip(g) : null;
}

function pickTip(g: Game): string {
  guideMarked(g, 'pickTip', 'done');
  return t('guide.pickTip');
}

/** The first won result with stars gets the line on what stars are for. */
export function starsTip(g: Game): boolean {
  if (g.autoplay || !g.stars || g.stars.stars === 0 || g.save.guide.includes('stars')) return false;
  guideMarked(g, 'stars', 'done');
  return true;
}
