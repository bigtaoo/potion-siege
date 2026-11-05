// A potion's talents (plan 3a): at Lv 10, 20 and 30 a pick of two, switched back free at any time.
// Each one changes what the potion does rather than how hard it hits: it starts the battle with
// a skill card's effect already on (a card of its own line, or a recipe whose effect works on
// its own shots alone), as if taken. A card a talent gave can still be taken on top, up to its
// most. Lv 30 takes both of Lv 10's or both of Lv 20's.
// None picked, as every save starts, changes nothing: the old balance and replays hold.

import { skillMax, type SkillId, type SkillLevels } from './skills';
import { HERO_KINDS, type HeroKind } from './types';

export const TALENT_LEVELS = [10, 20, 30] as const;
/** A tier's pick: -1 none yet, else 0 or 1. */
export type TalentPick = -1 | 0 | 1;
export type TalentPicks = Partial<Record<HeroKind, TalentPick[]>>;

/** What one talent gives: skill cards and how many of each. */
export type Grant = readonly (readonly [SkillId, number])[];

/** Lv 10's two and Lv 20's two of each potion. */
export const TALENTS: Record<HeroKind, readonly [readonly [Grant, Grant], readonly [Grant, Grant]]> = {
  arcane: [
    [[['arcaneMark', 1]], [['arcaneMulti', 1]]],
    [[['arcaneSplit', 1]], [['fireArcane', 1]]],
  ],
  fire: [
    [[['fireBurn', 1]], [['fireRadius', 2]]],
    [[['fireChain', 1]], [['fireBurn', 2]]],
  ],
  ice: [
    [[['iceFrostbite', 1]], [['iceFreeze', 2]]],
    [[['iceShatter', 1]], [['iceFreeze', 3]]],
  ],
  lightning: [
    [[['lightningStatic', 1]], [['lightningChain', 2]]],
    [[['lightningStrike', 1]], [['poisonLightning', 1]]],
  ],
  poison: [
    [[['poisonSplash', 1]], [['poisonRust', 1]]],
    [[['poisonMelt', 1]], [['poisonRust', 2]]],
  ],
  wind: [
    [[['windGust', 1]], [['windHaste', 2]]],
    [[['windVortex', 1]], [['windPush', 3]]],
  ],
  light: [
    [[['lightGlare', 1]], [['lightWide', 2]]],
    [[['lightFocus', 1]], [['lightFire', 1]]],
  ],
  metal: [
    [[['metalCrush', 1]], [['metalShrapnel', 2]]],
    [[['metalBreak', 1]], [['metalCrush', 2]]],
  ],
  vine: [
    [[['vineThorns', 1]], [['vineRoot', 2]]],
    [[['vineSpread', 1]], [['vinePoison', 1]]],
  ],
};

/** What option `pick` of `tier` (0, 1, 2 for Lv 10, 20, 30) gives `kind`. */
export function talentGrant(kind: HeroKind, tier: number, pick: 0 | 1): Grant {
  if (tier < 2) return TALENTS[kind][tier]![pick];
  const both = TALENTS[kind][pick];
  return [...both[0], ...both[1]];
}

/** The tiers a potion at `level` has open. */
export function talentTiers(level: number): number {
  return TALENT_LEVELS.filter((l) => level >= l).length;
}

/** Tiers open and not picked yet: the red dot on a potion's talents. */
export function talentsToPick(picks: TalentPicks, kind: HeroKind, level: number): number {
  const p = picks[kind] ?? [];
  let n = 0;
  for (let i = 0; i < talentTiers(level); i++) if ((p[i] ?? -1) < 0) n++;
  return n;
}

/** The picks a battle goes in with: the lineup's, those its levels have reached; none at all
 *  when nothing is picked. */
export function battleTalents(picks: TalentPicks, lineup: readonly HeroKind[], levels: Record<HeroKind, number>): TalentPicks | undefined {
  const out: TalentPicks = {};
  let any = false;
  for (const k of lineup) {
    const p = (picks[k] ?? []).slice(0, talentTiers(levels[k] ?? 0));
    if (p.some((x) => x >= 0)) {
      out[k] = p;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** Puts the talents' cards on the battle's starting skills, each up to its most. */
export function applyTalents(skills: SkillLevels, picks: TalentPicks | undefined): void {
  if (!picks) return;
  for (const k of HERO_KINDS) {
    (picks[k] ?? []).forEach((pick, tier) => {
      if (pick !== 0 && pick !== 1) return;
      for (const [id, n] of talentGrant(k, tier, pick)) skills[id] = Math.min(skillMax(id), skills[id] + n);
    });
  }
}

/** Picks `pick` (or -1 to clear) on `tier`; the switch is free. False on a tier not open. */
export function setTalent(picks: TalentPicks, kind: HeroKind, level: number, tier: number, pick: TalentPick): boolean {
  if (tier < 0 || tier >= talentTiers(level)) return false;
  const p = [...(picks[kind] ?? [])];
  while (p.length <= tier) p.push(-1);
  p[tier] = pick;
  picks[kind] = p;
  return true;
}

export function parseTalents(raw: unknown): TalentPicks {
  const out: TalentPicks = {};
  if (!raw || typeof raw !== 'object') return out;
  const d = raw as Record<string, unknown>;
  for (const k of HERO_KINDS) {
    const v = d[k];
    if (!Array.isArray(v)) continue;
    out[k] = v.slice(0, TALENT_LEVELS.length).map((x) => (x === 0 || x === 1 ? x : -1));
  }
  return out;
}
