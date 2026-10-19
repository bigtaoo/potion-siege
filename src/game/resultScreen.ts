// The result screen and where it leads: its ad offers (the revive, the ×2), the rating
// question, the next stage, the midgame ad between battles and the way back home.

import type { Game } from '../app';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { nextMilestone } from '../sim/endless';
import { FP } from '../sim/math/fixed';
import { doublesLeft, endOffers, maxStage } from '../sim/meta';
import { HERO_KINDS } from '../sim/types';
import { FEEDBACK_RUN, FeedbackAsk } from '../view/feedback';
import type { HomeTab } from '../view/Home';
import { offersNext } from '../view/nudges';
import { home } from './homeScreen';

export function showEnd(g: Game, b: Battle): void {
  const secs = Math.round(b.seconds);
  const stats = t('stats', { wave: b.wave, kills: b.kills, time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` });
  const run = g.challenge;
  const won = b.result === 'won';
  const next = !run && !g.endless && won && !g.autoplay && offersNext(g.save, b.setup.stage);
  if (!g.resultAt) {
    g.resultAt = performance.now();
    g.analytics.track('result_shown', { run: g.save.runs, stage: b.setup.stage, won, next, challenge: !!run });
    // the playtest's question, once, well after the first minute and battles 1-3; the portal has its own ratings
    if (g.save.runs >= FEEDBACK_RUN && g.platform.name === 'web' && !g.autoplay && g.analytics.sending && g.analytics.first('feedback_shown', { run: g.save.runs })) {
      g.ask = new FeedbackAsk((name, props) => g.analytics.track(name, props), g.save.runs);
    }
  }
  if (run?.result) {
    const dealt = HERO_KINDS.flatMap((kind) => (b.dealt[kind] > 0 ? [{ kind, damage: Math.round(b.dealt[kind] / FP) }] : []));
    const reward = { crystals: run.result.crystals + run.streakBonus, firstClear: false, unlocked: [] };
    g.overlay.showEnd(won, stats, reward, () => leaveResult(g, 'home'), null, {
      onDouble: null,
      doubled: false,
      dealt,
      onTip: null,
      challenge: { result: run.result, mods: run.ch.mods, trial: run.ch.trial, streak: g.save.challenge.streak, streakBonus: run.streakBonus },
    });
    return;
  }
  const ads = !g.autoplay && g.platform.rewardedAvailable();
  const { revive: canRevive, double: canDouble, capped } = endOffers(g.save, b.result === 'lost', g.revived, ads, g.purse);
  if (canRevive && !g.offered.revive) g.run?.onReviveOffer();
  if (canDouble && !g.offered.double) g.run?.onDoubleOffer();
  g.offered.revive ||= canRevive;
  g.offered.double ||= canDouble;
  const dealt = HERO_KINDS.flatMap((kind) => (b.dealt[kind] > 0 ? [{ kind, damage: Math.round(b.dealt[kind] / FP) }] : []));
  g.overlay.showEnd(won, stats, g.purse.reward, () => leaveResult(g, 'home'), canRevive ? () => {
    resultAction(g, 'revive');
    void revive(g, b);
  } : null, {
    onDouble: canDouble ? () => {
      resultAction(g, 'double');
      void double(g, b);
    } : null,
    doubled: g.purse.bonus > 0,
    doublesLeft: canDouble || capped ? doublesLeft(g.save) : undefined,
    dealt,
    onTip: b.result === 'lost' ? (tab) => leaveResult(g, 'tip', tab) : null,
    onNext: next ? () => void nextStage(g, b) : null,
    endless: g.endless?.result ? { result: g.endless.result, best: g.save.endless.best, next: nextMilestone(g.save) } : undefined,
  });
}

/** `result_action`: the result screen's tap, and how long after it came up. */
export function resultAction(g: Game, action: 'next' | 'home' | 'tip' | 'revive' | 'double', tab?: HomeTab): void {
  const secs = Math.round((performance.now() - g.resultAt) / 1000);
  g.analytics.track('result_action', { action, tab: tab ?? null, secs, run: g.save.runs });
  // leaving the result screen takes the question with it (the ×2 stays on it)
  if (action !== 'double') {
    g.ask?.close('left');
    g.ask = null;
  }
}

export function leaveResult(g: Game, action: 'home' | 'tip', tab?: HomeTab): void {
  resultAction(g, action, tab);
  void again(g, tab);
}

/** From a won stage's result straight into the next stage, no home screen between. */
export async function nextStage(g: Game, b: Battle): Promise<void> {
  resultAction(g, 'next');
  g.overlay.hide();
  g.save.stage = Math.min(maxStage(g.save), b.setup.stage + 1);
  g.store();
  g.analytics.track('battle_start_tap', { stage: g.save.stage, from: 'result', run: g.save.runs + 1 });
  await breakAd(g);
  g.newBattle('next');
  g.root.visible = true;
  g.platform.gameplayStart();
}

/** The portal's midgame ad between battles: never after the very first one, nor right after
 *  a rewarded one. */
export async function breakAd(g: Game): Promise<void> {
  if (g.save.runs > 1 && !g.rewardedSinceEnd) {
    await g.platform.midgame(() => g.mute(true));
    g.analytics.track('ad_midgame', { run: g.save.runs });
  }
  g.mute(false);
}

/** The rewarded ×2: what the battle earned, paid once more. */
export async function double(g: Game, b: Battle): Promise<void> {
  const ok = await g.watch();
  g.run?.onDoubleResult(ok);
  const bonus = g.purse.double(g.save, ok);
  if (bonus > 0) {
    g.store();
    g.analytics.track('crystals', { gain: bonus, total: g.save.crystals, stage: b.setup.stage, double: true });
  }
  if (g.overlay.visible) showEnd(g, b);
}

export async function revive(g: Game, b: Battle): Promise<void> {
  g.overlay.hide();
  let ok = false;
  try {
    ok = await g.platform.rewarded(() => g.mute(true));
  } catch {
    // an ad that broke counts as not watched: the result comes back up without the revive
  } finally {
    g.mute(false);
  }
  g.run?.onReviveResult(ok);
  if (ok) {
    g.revived = true;
    g.ended = false;
    b.revive();
    g.platform.gameplayStart();
  } else {
    g.revived = true; // one offer per battle, even when the ad failed
    showEnd(g, b);
  }
}

/** Back home (to `tab`, when a tip after a loss was tapped). */
export async function again(g: Game, tab?: HomeTab): Promise<void> {
  g.overlay.hide();
  if (tab) g.tab = tab;
  await breakAd(g);
  if (!g.autoplay) {
    home(g);
    return;
  }
  g.newBattle('autoplay');
  g.platform.gameplayStart();
}
