// The progress kept between battles: crystals earned at the end of each battle, spent on hero
// levels and workshop upgrades, and the stages, each one tougher than the last. Pure data and
// rules; the shell loads and stores it and the battle only sees the resulting BattleSetup.

import { newDaily, parseDaily, type DailySave } from './daily';
import { BALANCE, HERO_KINDS, LINEUP, type HeroKind } from './types';

const M = BALANCE.meta;

export const WORKSHOP_IDS = ['wall', 'startGold', 'crystals'] as const;
export type WorkshopId = (typeof WORKSHOP_IDS)[number];

export interface MetaSave {
  crystals: number;
  /** 1-based level of each hero kind. */
  heroes: Record<HeroKind, number>;
  workshop: Record<WorkshopId, number>;
  /** Highest stage won; stage `cleared + 1` is the furthest one open. */
  cleared: number;
  /** The stage the next battle is fought on. */
  stage: number;
  bestWave: number;
  runs: number;
  daily: DailySave;
  /** Potions unlocked beyond the starting four, by a stage cleared or bought. */
  unlocked: HeroKind[];
  /** The four potions taken into battle, all unlocked. */
  lineup: HeroKind[];
}

/** What a battle is set up with, from the stage and the upgrades. */
export interface BattleSetup {
  stage: number;
  /** Multiplier on enemy hit points. */
  enemyHp: number;
  heroDamage: Record<HeroKind, number>;
  /** Hero levels, for the skills and perks their milestones unlock. */
  heroLevels: Record<HeroKind, number>;
  /** The four potions summons and merges roll from. */
  lineup: readonly HeroKind[];
  wallHp: number;
  startGold: number;
}

export function newMeta(): MetaSave {
  return {
    crystals: 0,
    heroes: { arcane: 1, fire: 1, ice: 1, lightning: 1, poison: 1 },
    workshop: { wall: 0, startGold: 0, crystals: 0 },
    cleared: 0,
    stage: 1,
    bestWave: 0,
    runs: 0,
    daily: newDaily(),
    unlocked: [],
    lineup: [...LINEUP],
  };
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Reads a stored save, filling in anything missing or broken; the old save (bestWave and runs
 *  only) becomes a fresh one that keeps those two. */
export function parseMeta(raw: string | null): MetaSave {
  const out = newMeta();
  let data: Record<string, unknown> = {};
  try {
    const v: unknown = JSON.parse(raw ?? '{}');
    if (v && typeof v === 'object') data = v as Record<string, unknown>;
  } catch {
    return out;
  }
  const heroes = (data.heroes ?? {}) as Record<string, unknown>;
  const workshop = (data.workshop ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(out.heroes) as HeroKind[]) out.heroes[k] = int(heroes[k], 1, M.heroMax, 1);
  for (const k of WORKSHOP_IDS) out.workshop[k] = int(workshop[k], 0, M.workshop[k].max, 0);
  out.crystals = int(data.crystals, 0, Number.MAX_SAFE_INTEGER, 0);
  out.cleared = int(data.cleared, 0, M.stageCount, 0);
  out.stage = int(data.stage, 1, maxStage(out), 1);
  out.bestWave = int(data.bestWave, 0, 999, 0);
  out.runs = int(data.runs, 0, Number.MAX_SAFE_INTEGER, 0);
  out.daily = parseDaily(data.daily);
  // a save from before a potion could be unlocked gets what its cleared stages have earned
  const unlocked = Array.isArray(data.unlocked) ? data.unlocked : [];
  for (const k of HERO_KINDS) if (!LINEUP.includes(k) && (unlocked.includes(k) || stageUnlocks(out.cleared).includes(k))) out.unlocked.push(k);
  // a broken lineup falls back to the starting four
  const lineup = (Array.isArray(data.lineup) ? data.lineup : []).filter((k, i, a): k is HeroKind => HERO_KINDS.includes(k) && heroUnlocked(out, k) && a.indexOf(k) === i);
  if (lineup.length === LINEUP.length) out.lineup = lineup;
  return out;
}

/** The furthest stage open to play. */
export function maxStage(m: MetaSave): number {
  return Math.min(M.stageCount, m.cleared + 1);
}

export function stageHp(stage: number): number {
  return M.stageHpGrowth ** (stage - 1);
}

export function heroDamage(level: number): number {
  return 1 + M.heroDamage * (level - 1);
}

/** Crystals to go from `level` to the next, or null at the top. */
export function heroCost(level: number): number | null {
  if (level >= M.heroMax) return null;
  return Math.round((M.heroCost.base * M.heroCost.growth ** (level - 1)) / 5) * 5;
}

export function workshopCost(id: WorkshopId, level: number): number | null {
  const w = M.workshop[id];
  if (level >= w.max) return null;
  return Math.round((w.base * w.growth ** level) / 5) * 5;
}

/** The workshop bonus at a level: a fraction for wall and crystals, gold for startGold. */
export function workshopValue(id: WorkshopId, level: number): number {
  return M.workshop[id].step * level;
}

export function buyHero(m: MetaSave, kind: HeroKind): boolean {
  const cost = heroCost(m.heroes[kind]);
  if (!heroUnlocked(m, kind) || cost === null || m.crystals < cost) return false;
  m.crystals -= cost;
  m.heroes[kind]++;
  return true;
}

export function buyWorkshop(m: MetaSave, id: WorkshopId): boolean {
  const cost = workshopCost(id, m.workshop[id]);
  if (cost === null || m.crystals < cost) return false;
  m.crystals -= cost;
  m.workshop[id]++;
  return true;
}

export function battleSetup(m: MetaSave, stage = m.stage): BattleSetup {
  const heroes = {} as Record<HeroKind, number>;
  for (const k of Object.keys(m.heroes) as HeroKind[]) heroes[k] = heroDamage(m.heroes[k]);
  return {
    stage,
    enemyHp: stageHp(stage),
    heroDamage: heroes,
    heroLevels: { ...m.heroes },
    lineup: [...m.lineup],
    wallHp: BALANCE.wallHp * (1 + workshopValue('wall', m.workshop.wall)),
    startGold: BALANCE.startGold + workshopValue('startGold', m.workshop.startGold),
  };
}

/** The setup of a battle without any progress: stage 1, nothing upgraded. */
export const BASE_SETUP: BattleSetup = battleSetup(newMeta(), 1);

export interface RunResult {
  stage: number;
  won: boolean;
  wave: number;
  kills: number;
}

export interface Reward {
  crystals: number;
  /** True when this battle cleared its stage for the first time. */
  firstClear: boolean;
  /** Potions that first clear unlocked. */
  unlocked: HeroKind[];
}

/** Crystals for a battle, won or lost: waves reached and kills, more on later stages, a bonus
 *  for winning and a bigger one the first time a stage is won. */
export function runReward(m: MetaSave, r: RunResult): Reward {
  const R = M.reward;
  const firstClear = r.won && r.stage > m.cleared;
  let base = R.perWave * r.wave + Math.floor(r.kills / R.perKills) + (r.won ? R.winBonus : 0);
  base *= 1 + R.stageStep * (r.stage - 1);
  if (firstClear) base += R.firstClear * r.stage;
  const unlocked = firstClear ? stageUnlocks(r.stage).filter((k) => !heroUnlocked(m, k)) : [];
  return { crystals: Math.round(base * (1 + workshopValue('crystals', m.workshop.crystals))), firstClear, unlocked };
}

/** Books a finished battle into the save; a first clear opens the next stage and moves to it. */
export function applyRun(m: MetaSave, r: RunResult, reward: Reward): void {
  m.crystals += reward.crystals;
  m.bestWave = Math.max(m.bestWave, r.wave);
  if (reward.firstClear) {
    m.cleared = r.stage;
    m.stage = maxStage(m);
  }
  for (const k of reward.unlocked) unlockHero(m, k);
}

/** What one battle has paid out. A revived battle ending again pays only what it earned on top,
 *  and the rewarded ×2 pays what was earned so far once more, once per battle. */
export class Purse {
  /** Crystals the battle itself has earned. */
  paid = 0;
  /** Crystals the ×2 ad added. */
  bonus = 0;
  /** The ×2 has been offered and taken (or its ad failed): not offered again. */
  doubled = false;
  firstClear = false;
  unlocked: HeroKind[] = [];

  /** Books a result screen's reward; returns the crystals to pay now. */
  settle(m: MetaSave, r: RunResult): Reward {
    const reward = runReward(m, r);
    const gain = Math.max(0, reward.crystals - this.paid);
    this.paid += gain;
    this.firstClear ||= reward.firstClear;
    this.unlocked.push(...reward.unlocked);
    applyRun(m, r, { ...reward, crystals: gain });
    return { ...reward, crystals: gain };
  }

  /** The ×2 ad has ended (`ok`: it was watched); returns the crystals it paid. */
  double(m: MetaSave, ok: boolean): number {
    if (this.doubled) return 0;
    this.doubled = true;
    if (!ok) return 0;
    this.bonus = this.paid;
    m.crystals += this.bonus;
    return this.bonus;
  }

  /** What the result screen shows. */
  get reward(): Reward {
    return { crystals: this.paid + this.bonus, firstClear: this.firstClear, unlocked: this.unlocked };
  }
}

/** Which rewarded ads a result screen offers: the revive after a loss, once per battle, and the
 *  ×2 once per battle when there is something to double and no revive is on offer. */
export function endOffers(lost: boolean, revived: boolean, ads: boolean, purse: Purse): { revive: boolean; double: boolean } {
  const revive = ads && lost && !revived;
  return { revive, double: ads && !revive && !purse.doubled && purse.paid > 0 };
}

/** The stage whose first clear unlocks a potion outside the starting lineup, or null. */
export function unlockStage(kind: HeroKind): number | null {
  const h = BALANCE.heroes[kind] as { unlockStage?: number };
  return LINEUP.includes(kind) ? null : (h.unlockStage ?? null);
}

/** The potions unlocked by first clears up to `stage`. */
function stageUnlocks(stage: number): HeroKind[] {
  return HERO_KINDS.filter((k) => {
    const s = unlockStage(k);
    return s !== null && s <= stage;
  });
}

/** Whether a potion can be played and levelled: the starting four, and those unlocked since. */
export function heroUnlocked(m: MetaSave, kind: HeroKind): boolean {
  return LINEUP.includes(kind) || m.unlocked.includes(kind);
}

/** The one place a potion gets unlocked: a stage's first clear, or the shop. False when it was
 *  open already. */
export function unlockHero(m: MetaSave, kind: HeroKind): boolean {
  if (heroUnlocked(m, kind)) return false;
  m.unlocked.push(kind);
  return true;
}

/** Swaps `out` of the lineup for `into`, which takes its place; false (nothing changes) unless
 *  `out` is in the lineup and `into` is an unlocked potion that is not. */
export function swapLineup(m: MetaSave, out: HeroKind, into: HeroKind): boolean {
  const i = m.lineup.indexOf(out);
  if (i < 0 || m.lineup.includes(into) || !heroUnlocked(m, into)) return false;
  m.lineup[i] = into;
  return true;
}

/** Unlocked potions left out of the lineup, in hero order. */
export function benched(m: MetaSave): HeroKind[] {
  return HERO_KINDS.filter((k) => heroUnlocked(m, k) && !m.lineup.includes(k));
}
