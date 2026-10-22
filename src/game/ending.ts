// A battle's end booked: a stage's crystals and runs, a challenge attempt's tier, an endless
// run's waves and milestones, before the result screen comes up.

import type { Game } from '../app';
import { recordChallenge } from '../sim/achievements';
import type { Battle } from '../sim/battle';
import { bookAttempt } from '../sim/challenge';
import { addProgress, dayOf, rollDay } from '../sim/daily';
import { bookEndless, endlessPay } from '../sim/endless';
import { bookStars, hardReward, runStars } from '../sim/stars';
import { again, showEnd } from './resultScreen';
import { endTutorial } from './tutorialFlow';

export function finish(g: Game, b: Battle): void {
  g.ended = true;
  g.rewardedSinceEnd = false;
  if (g.challenge) {
    finishChallenge(g, b, g.challenge);
    return;
  }
  if (g.endless) {
    finishEndless(g, b, g.endless);
    return;
  }
  g.platform.gameplayStop();
  // the tutorial belongs to the first battle only, however far it got
  if (g.tutorial) endTutorial(g, true);
  rollDay(g.save, dayOf(new Date()));
  if (!g.revived) {
    g.save.runs++; // a revived run ending again is still one run
    if (!g.autoplay) addProgress(g.save, 'play');
  }
  if (b.result === 'won' && !g.autoplay) addProgress(g.save, 'win');
  const result = { stage: b.setup.stage, won: b.result === 'won', wave: b.wave, kills: b.kills };
  const hard = b.setup.hard === true;
  // a revived battle ending again pays only what it earned on top
  const { crystals: gain, firstClear } = g.purse.settle(g.save, result, hard ? hardReward(g.save, result) : undefined);
  if (result.won) {
    g.stars = bookStars(g.save, result.stage, hard, runStars(true, g.revived, Math.max(0, b.wall) / b.wallMax));
    g.analytics.track('stars', { stage: result.stage, hard, stars: g.stars.stars, before: g.stars.before });
  }
  g.store();
  // the portal's happytime is for rare moments: a stage beaten for the first time, not every win
  if (b.result === 'won' && firstClear && !g.autoplay) g.platform.celebrate();
  g.run?.onEnd();
  g.perf.end();
  g.analytics.track('crystals', { gain, total: g.save.crystals, stage: result.stage, first: firstClear });
  showEnd(g, b);
  if (g.autoplay) setTimeout(() => void again(g), 1500);
}

/** Books a challenge attempt: the tier it reached pays what it adds to today's best; no
 *  campaign crystals, no revive and no ×2. */
export function finishChallenge(g: Game, b: Battle, run: NonNullable<Game['challenge']>): void {
  g.platform.gameplayStop();
  rollDay(g.save, dayOf(new Date()));
  g.save.runs++;
  addProgress(g.save, 'play');
  addProgress(g.save, 'challenge');
  if (b.result === 'won') addProgress(g.save, 'win');
  run.result = bookAttempt(g.save, b.wave);
  recordChallenge(g.save, run.result.tier);
  g.save.bestWave = Math.max(g.save.bestWave, b.wave);
  g.store();
  if (run.result.crystals > 0) g.platform.celebrate(); // a new best tier today
  g.run?.onEnd();
  g.perf.end();
  g.analytics.track('challenge_end', { day: run.ch.day, wave: b.wave, tier: run.result.tier, gain: run.result.crystals, attempt: g.save.challenge.attempts });
  showEnd(g, b);
}

/** Books an endless run: the per-wave crystals through the purse (so the revive and the ×2
 *  work as after a stage), then the best wave and any milestone reached for the first time. */
export function finishEndless(g: Game, b: Battle, run: NonNullable<Game['endless']>): void {
  g.platform.gameplayStop();
  rollDay(g.save, dayOf(new Date()));
  if (!g.revived) {
    g.save.runs++;
    addProgress(g.save, 'play');
    addProgress(g.save, 'endless');
  }
  const result = { stage: b.setup.stage, won: false, wave: b.wave, kills: b.kills };
  const { crystals: gain } = g.purse.settle(g.save, result, { crystals: endlessPay(g.save, b.wave), firstClear: false, unlocked: [] });
  const booked = bookEndless(g.save, b.wave);
  // a revived run ending again: the best before the run still counts, milestones add up
  run.result = run.result ? { ...booked, before: run.result.before, record: b.wave > run.result.before, milestones: run.result.milestones + booked.milestones } : booked;
  g.store();
  if (booked.milestones > 0 || (booked.record && booked.before > 0)) g.platform.celebrate();
  g.run?.onEnd();
  g.perf.end();
  g.analytics.track('endless_end', { wave: b.wave, best: g.save.endless.best, record: run.result.record, gain, milestones: booked.milestones, revived: g.revived });
  showEnd(g, b);
}
