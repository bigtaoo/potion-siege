// A stage that keeps winning (plan 4a, 4c): losses in a row on one stage, normal mode. Past
// stage 3 (lossStreak.ts helps there) the `assistAfter`th loss in a row brings the same start
// gold help to the next try; the `exitsAfter`th makes the result screen offer three ways round
// it: a lineup that sets off more reactions, hard mode of a chapter behind, the tower.

import { ASSIST_GOLD, ASSIST_UNTIL } from './lossStreak';
import { heroUnlocked, type BattleSetup, type MetaSave } from './meta';
import { reactionOf } from './reactions';
import { BALANCE, HERO_KINDS, type HeroKind, type ReactionId } from './types';

const S = BALANCE.alchemy.stuck;

/** Books a battle's end on `stage`: a loss adds one (starting over on another stage), a win
 *  clears it. Hard mode leaves it as it is. */
export function bookStuck(m: MetaSave, stage: number, won: boolean, hard: boolean): void {
  if (hard) return;
  const s = m.alchemy.stuck;
  if (won) m.alchemy.stuck = { stage: 0, n: 0 };
  else m.alchemy.stuck = { stage, n: s.stage === stage ? s.n + 1 : 1 };
}

/** Losses in a row on `stage`. */
export function lossesOn(m: MetaSave, stage: number): number {
  return m.alchemy.stuck.stage === stage ? m.alchemy.stuck.n : 0;
}

/** The setup with the start gold help past stage 3, once the losses there have earned it. */
export function stuckAssist(m: MetaSave, setup: BattleSetup): BattleSetup {
  if (setup.stage <= ASSIST_UNTIL || setup.hard || lossesOn(m, setup.stage) < S.assistAfter) return setup;
  return { ...setup, startGold: setup.startGold + ASSIST_GOLD };
}

/** Whether the result screen offers the ways round the stage. */
export function showExits(m: MetaSave, stage: number): boolean {
  return lossesOn(m, stage) >= S.exitsAfter;
}

export interface LineupTip {
  lineup: HeroKind[];
  reactions: ReactionId[];
}

const ELEMENTS: readonly string[] = ['fire', 'ice', 'lightning', 'poison'];

/** The reaction `by` sets off on what `on` leaves behind, if `on` leaves an element. */
function pairReaction(by: HeroKind, on: HeroKind): ReactionId | null {
  return ELEMENTS.includes(on) ? reactionOf(by, on as Parameters<typeof reactionOf>[1]) : null;
}

/** The reactions four potions set off between them. */
export function reactionsOf(kinds: readonly HeroKind[]): ReactionId[] {
  const out: ReactionId[] = [];
  for (let i = 0; i < kinds.length; i++)
    for (let j = i + 1; j < kinds.length; j++) {
      const r = pairReaction(kinds[i], kinds[j]) ?? pairReaction(kinds[j], kinds[i]);
      if (r && !out.includes(r)) out.push(r);
    }
  return out;
}

/** A lineup of four unlocked potions to try instead: the most reactions between them, then the
 *  most levels; never the one fielded now. Null with no other four to field. */
export function suggestLineup(m: MetaSave): LineupTip | null {
  const open = HERO_KINDS.filter((k) => heroUnlocked(m, k));
  const now = [...m.lineup].sort().join();
  let best: LineupTip | null = null;
  let bestScore = -1;
  const pick = (from: number, chosen: HeroKind[]) => {
    if (chosen.length === 4) {
      if ([...chosen].sort().join() === now) return;
      const reactions = reactionsOf(chosen);
      const score = reactions.length * 1000 + chosen.reduce((s, k) => s + m.heroes[k], 0);
      if (score > bestScore) {
        bestScore = score;
        best = { lineup: [...chosen], reactions };
      }
      return;
    }
    for (let i = from; i < open.length; i++) pick(i + 1, [...chosen, open[i]]);
  };
  pick(0, []);
  return best;
}
