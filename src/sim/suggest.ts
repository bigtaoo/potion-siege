// The skill card a new player is pointed at: the "推荐" tag over it in the first battles and the
// hand that taps it when the cards are left alone (view/overlay/cardNudge.ts). Only a pointer:
// the pick stays the player's and nothing here touches the battle.

import type { Battle } from './battle';
import { skillHeroes, type SkillId } from './skills';

/** What a card is worth to the board as it stands: a potion's skill by how much of that kind
 *  is fielded (a star doubles it), a recipe only with both kinds there, the shared damage and
 *  speed cards a little under half the board, gold a little under that, the wall repair only
 *  once the wall is under half. */
function worth(b: Battle, id: SkillId, power: (kind?: string) => number): number {
  const { hero, with: other } = skillHeroes(id);
  if (hero) return other && power(other) === 0 ? 0 : power(hero);
  if (id === 'wallRepair') return b.wall < b.wallMax / 2 ? power() : 0;
  if (id === 'gold') return power() * 0.3;
  return power() * 0.45;
}

/** The index in `choices` of the card to point at: the one worth most, the one taken less on
 *  a tie, the leftmost after that. */
export function suggestSkill(b: Battle, choices: readonly SkillId[]): number {
  const power = (kind?: string) => b.slots.reduce((sum, h) => (h && (!kind || h.kind === kind) ? sum + (1 << (h.star - 1)) : sum), 0);
  let best = 0;
  let bestWorth = -1;
  choices.forEach((id, i) => {
    const w = worth(b, id, power);
    if (w > bestWorth || (w === bestWorth && b.skills[id] < b.skills[choices[best]])) {
      best = i;
      bestWorth = w;
    }
  });
  return best;
}
