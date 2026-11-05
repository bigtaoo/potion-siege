import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { battleSetup, newMeta, parseMeta } from './meta';
import { emptySkills, skillMax } from './skills';
import { applyTalents, battleTalents, parseTalents, setTalent, talentGrant, TALENTS, talentsToPick, talentTiers } from './talents';
import { HERO_KINDS } from './types';

describe('talents', () => {
  it('opens a tier at Lv 10, 20 and 30', () => {
    expect([1, 9, 10, 19, 20, 30, 40].map(talentTiers)).toEqual([0, 0, 1, 1, 2, 3, 3]);
  });

  it('gives each potion two different picks a tier, Lv 30 both of a tier below', () => {
    for (const k of HERO_KINDS) {
      for (const tier of [0, 1]) expect(JSON.stringify(TALENTS[k][tier]![0])).not.toBe(JSON.stringify(TALENTS[k][tier]![1]));
      expect(talentGrant(k, 2, 0)).toEqual([...TALENTS[k][0][0], ...TALENTS[k][0][1]]);
      expect(talentGrant(k, 2, 1)).toEqual([...TALENTS[k][1][0], ...TALENTS[k][1][1]]);
    }
  });

  it('picks only on an open tier, and switches back free', () => {
    const p = {};
    expect(setTalent(p, 'fire', 15, 1, 0)).toBe(false);
    expect(setTalent(p, 'fire', 15, 0, 1)).toBe(true);
    expect(talentsToPick(p, 'fire', 25)).toBe(1);
    expect(setTalent(p, 'fire', 15, 0, -1)).toBe(true);
    expect(talentsToPick(p, 'fire', 15)).toBe(1);
    expect(parseTalents({ fire: [1, 7, 0, 0, 1], bogus: [1], ice: 'x' })).toEqual({ fire: [1, -1, 0] });
  });

  it('goes into a battle only for the lineup, only as far as its level reached', () => {
    const levels = { arcane: 12, fire: 25, ice: 5, lightning: 1, poison: 30, wind: 30, light: 1, metal: 1, vine: 1 };
    expect(battleTalents({ fire: [0, 1, 0], ice: [1], poison: [0] }, ['fire', 'ice', 'arcane', 'wind'], levels)).toEqual({ fire: [0, 1] });
    expect(battleTalents({}, ['fire'], levels)).toBeUndefined();
  });

  it('starts the battle with the cards on, each up to its most', () => {
    const s = emptySkills();
    applyTalents(s, { fire: [0, 1, 1] });
    // embers 1, inferno 2 and Lv 30 again both of Lv 20: capped at burn's most
    expect(s.fireBurn).toBe(skillMax('fireBurn'));
    expect(s.fireChain).toBe(1);
    const m = newMeta();
    m.heroes.fire = 12;
    m.lineup = ['fire', 'arcane', 'ice', 'lightning'];
    expect(battleSetup(m).talents).toBeUndefined();
    setTalent(m.alchemy.talents, 'fire', 12, 0, 1);
    const b = new Battle(5, battleSetup(m));
    expect(b.skills.fireRadius).toBe(2);
    expect(b.mods.fireRadius).toBeGreaterThan(1);
    expect(parseMeta(JSON.stringify(m)).alchemy.talents).toEqual({ fire: [1] });
  });
});
