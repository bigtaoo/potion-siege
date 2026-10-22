// The skill cards and recipes under a player who picks at random: every four-of-six lineup on a
// maxed save, the bot playing but buying an upgrade (each one opens an offer) whenever it can
// once the grid is half full, and taking a random card at each offer: an offer always has cards,
// the commander casts, and nothing in the battle turns NaN or negative on the way. And every card
// and recipe is on offer to some lineup.
import { describe, expect, it } from 'vitest';
import { Battle, SLOT_COUNT } from './battle';
import { botAct } from './bot';
import { Prng } from './math/prng';
import { battleSetup } from './meta';
import { SAVES } from './setupCatalog';
import { emptySkills, rollChoices, SKILL_IDS, type SkillId } from './skills';
import { HERO_KINDS, type HeroKind } from './types';

const CAP = 1200 * 30;

/** Every way to field four of the six potions. */
function lineups(): HeroKind[][] {
  const out: HeroKind[][] = [];
  const pick = (from: number, got: HeroKind[]) => {
    if (got.length === 4) out.push(got);
    else for (let i = from; i < HERO_KINDS.length; i++) pick(i + 1, [...got, HERO_KINDS[i]]);
  };
  pick(0, []);
  return out;
}

describe('random card picks', () => {
  it('keep every battle sane', () => {
    const m = SAVES.maxed();
        const bad: string[] = [];
    const all = lineups();
    expect(all).toHaveLength(15);
    for (const lineup of all) {
      for (const seed of [1, 2]) {
        const at = `[${lineup}] seed ${seed}`;
        const b = new Battle(seed, { ...battleSetup(m, 25), lineup });
        const rng = new Prng(seed * 7919);
        for (let t = 0; t < CAP && b.result === null; t++) {
          if (b.choices) {
            if (!b.choices.length) bad.push(`${at}: an offer with no cards`);
            b.choose(b.choices[rng.int(b.choices.length)]);
          } else if (b.canUpgrade() && b.freeSlots().length <= SLOT_COUNT / 2) b.upgrade();
          else botAct(b);
          b.step();
          b.drain();
          if (b.gold < 0 || !Number.isFinite(b.wall) || !Number.isFinite(b.charge)) bad.push(`${at}: gold ${b.gold} wall ${b.wall} charge ${b.charge}`);
          if (b.enemies.some((e) => !Number.isFinite(e.hp) || !Number.isFinite(e.x))) bad.push(`${at}: an enemy went NaN`);
          if (bad.length) break;
        }
        if (b.result === null) bad.push(`${at}: still going at the cap`);
        if (b.casts === 0) bad.push(`${at}: the commander never cast`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('can offer every card and recipe to some lineup', () => {
    const levels = SAVES.maxed().heroes;
    const offered = new Set<SkillId>();
    const rng = new Prng(1);
    for (const lineup of lineups()) for (let i = 0; i < 400; i++) for (const id of rollChoices(rng, emptySkills(), new Set(lineup), levels)) offered.add(id);
    expect(SKILL_IDS.filter((id) => !offered.has(id))).toEqual([]);
  });
});
