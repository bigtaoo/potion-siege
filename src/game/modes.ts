// The battle tab's other modes started: an endless run, and today's challenge (its second go
// bought with a rewarded ad).

import type { Game } from '../app';
import { beginAttempt, todaysChallenge } from '../sim/challenge';
import { dayOf } from '../sim/daily';
import { beginEndless } from '../sim/endless';
import { home } from './homeScreen';

/** Starts an endless run from the battle tab. */
export function playEndless(g: Game): void {
  beginEndless(g.save);
  g.store();
  g.analytics.track('endless_start', { best: g.save.endless.best, runs: g.save.endless.runs });
  g.newBattle('endless');
  g.menu.visible = false;
  g.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
  g.root.visible = true;
  g.platform.gameplayStart();
}

/** Starts today's challenge (`ad`: the retry a rewarded ad bought). */
export function playChallenge(g: Game, ad: boolean): void {
  const today = dayOf(new Date());
  const ch = todaysChallenge(g.save, today);
  const bonus = beginAttempt(g.save, today, ad);
  if (bonus === null) return;
  g.store();
  g.analytics.track('challenge_start', { day: today, stage: ch.stage, mods: ch.mods.join(','), ad, streak: g.save.challenge.streak });
  g.newBattle('challenge', ch);
  g.hud.showMods(ch.mods, ch.trial);
  g.challenge = { ch, streakBonus: bonus, result: null };
  g.menu.visible = false;
  g.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
  g.root.visible = true;
  g.platform.gameplayStart();
}

/** The rewarded ad for a second go at today's challenge; the menu takes no taps while it plays. */
export async function challengeAd(g: Game): Promise<void> {
  g.menu.interactiveChildren = false;
  let ok = false;
  try {
    ok = await g.platform.rewarded(() => g.mute(true));
  } catch {
    // not watched: no retry
  } finally {
    g.menu.interactiveChildren = true;
    g.mute(false);
  }
  g.analytics.track('ad_challenge', { ok });
  if (ok) playChallenge(g, true);
  else if (g.menu.visible) home(g);
}
