// One shard of `npm run economy` (scripts/economy.mjs runs the shards and writes the report):
// PLAYERS simulated players of one PROFILE play day after day from a fresh save, every battle a
// real bot battle on the save they have, so a stage is only cleared once the upgrades allow it.
// A day is one session of the profile's minutes: login, free chest, (ADS=1) the three shop ads,
// the daily challenge (and its ad attempt), then battles until the minutes are used up, each one
// booked like the game does (Purse, tasks, the all-tasks bonus, achievements; ADS=1 takes the
// revive and the result ×2). After every battle the player buys cheapest first: hero levels of
// the fielded four and workshop levels, then the benched potions once those are maxed.
// Stage choice: the furthest open stage, until two losses in a row there (reset by a purchase or
// a new day); then the highest cleared stage it can still win, stepping down after a loss.
// Env: PROFILE casual|regular|heavy, ADS 0|1, PLAYERS, DAYS, BAL='{...}' (as balance.test.ts),
// STAGES (stage count, e.g. 50; stages past 20 keep stageHpLate growth), ENDLESS (placeholder
// crystals per endless run, played instead of farming once ENDLESS_FROM stages are cleared),
// CHAPTER_CHEST (crystals × the chapter on the first clear of every tenth stage), LATE_GROWTH
// (enemy hit points a stage past 20 instead of stageHpLate.growth), TAG, OUT_DIR. The result ×2
// keeps to shop.doublesPerDay as in the game (BAL='{"shop":{"doublesPerDay":999}}' lifts it).
import { it } from 'vitest';
import { claimTier, recordChallenge, recordEvents, TRACK_IDS } from '../src/sim/achievements';
import { Battle } from '../src/sim/battle';
import { botAct } from '../src/sim/bot';
import { beginAttempt, bookAttempt, challengeSetup, todaysChallenge } from '../src/sim/challenge';
import { addProgress, claimBonus, claimLogin, claimTask, rollDay } from '../src/sim/daily';
import { TICK_RATE } from '../src/sim/math/fixed';
import { battleSetup, stageHp, buyHero, buyWorkshop, claimAd, claimChest, doublesLeft, heroCost, heroUnlocked, newMeta, Purse, workshopCost, WORKSHOP_IDS, type BattleSetup, type MetaSave } from '../src/sim/meta';
import { bookStars, hardReward, hardSetup, runStars } from '../src/sim/stars';
import { BALANCE, HERO_KINDS } from '../src/sim/types';
import { offFrontier } from './economyStars';

function merge(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object') merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
}

interface Fs {
  mkdirSync(p: string, o: { recursive: boolean }): void;
  writeFileSync(p: string, s: string): void;
}
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; getBuiltinModule(id: string): unknown } }).process;
const env = proc.env;

/** Session minutes a day, and the minutes a battle costs on top of its own length (the result
 *  screen, the upgrade screen, the walk back). A shop ad or the ×2 or revive ad is 0.5 min. */
export const PROFILES = {
  casual: { minutes: 15 },
  regular: { minutes: 40 },
  heavy: { minutes: 120 },
} as const;
const OVERHEAD = 0.4;
const AD_MIN = 0.5;
const ENDLESS_MIN = 6;

type Source = 'runs' | 'double' | 'login' | 'tasks' | 'chest' | 'ads' | 'challenge' | 'achievements' | 'chapter' | 'endless';
const SOURCES: Source[] = ['runs', 'double', 'login', 'tasks', 'chest', 'ads', 'challenge', 'achievements', 'chapter', 'endless'];

interface Day {
  day: number;
  earned: Record<Source, number>;
  spent: number;
  /** Purchases made this session. */
  buys: number;
  battles: number;
  frontierTries: number;
  frontierWins: number;
  cleared: number;
  /** Crystals left at the end of the session, and the price of the next thing to buy. */
  left: number;
  next: number | null;
  heroes: number[];
  workshop: number[];
  maxed: boolean;
}

/** The next buy: the cheapest level of the fielded four or the workshop; the benched potions
 *  only once all of those are maxed (they do not help in battle). */
function nextBuy(m: MetaSave): { cost: number; buy: () => boolean } | null {
  let best: { cost: number; buy: () => boolean } | null = null;
  for (const k of m.lineup) {
    const c = heroCost(m.heroes[k]);
    if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k) };
  }
  for (const id of WORKSHOP_IDS) {
    const c = workshopCost(id, m.workshop[id]);
    if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyWorkshop(m, id) };
  }
  if (best) return best;
  for (const k of HERO_KINDS) {
    if (m.lineup.includes(k) || !heroUnlocked(m, k)) continue;
    const c = heroCost(m.heroes[k]);
    if (c !== null && (!best || c < best.cost)) best = { cost: c, buy: () => buyHero(m, k) };
  }
  return best;
}

function maxed(m: MetaSave): boolean {
  return HERO_KINDS.every((k) => heroUnlocked(m, k) && heroCost(m.heroes[k]) === null) && WORKSHOP_IDS.every((id) => workshopCost(id, m.workshop[id]) === null);
}

function dayName(d: number): string {
  return new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
}

interface Played {
  b: Battle;
  revived: boolean;
  skills: number;
}

/** One bot battle, events into the tasks and achievements; `revive` takes the revive ad. */
function play(m: MetaSave, seed: number, setup: BattleSetup, revive: boolean): Played {
  const b = new Battle(seed, setup);
  let skills = 0;
  let revived = false;
  for (;;) {
    for (let t = 0; t < 1200 * TICK_RATE && b.result === null; t++) {
      if (b.choices) skills++;
      botAct(b);
      b.step();
      const events = b.drain();
      recordEvents(m, events);
      for (const ev of events) {
        if (ev.type === 'summon') addProgress(m, 'summon');
        else if (ev.type === 'merge') {
          addProgress(m, 'merge');
          if (ev.star === BALANCE.maxStar) addProgress(m, 'ultimate');
        } else if (ev.type === 'kill') {
          addProgress(m, 'kill');
          if (ev.boss) addProgress(m, 'boss');
        }
      }
    }
    if (b.result === 'lost' && revive && !revived) {
      revived = true;
      b.revive();
      continue;
    }
    break;
  }
  addProgress(m, 'skill', skills);
  return { b, revived, skills };
}

it('economy', () => {
  if (env.BAL) merge(BALANCE as unknown as Record<string, unknown>, JSON.parse(env.BAL));
  if (env.STAGES) BALANCE.meta.stageCount = Number(env.STAGES);
  const profile = (env.PROFILE ?? 'regular') as keyof typeof PROFILES;
  const minutes = PROFILES[profile].minutes;
  const ads = env.ADS === '1';
  const players = Number(env.PLAYERS ?? 3);
  const first = Number(env.PLAYER0 ?? 0);
  const days = Number(env.DAYS ?? 60);
  const endless = Number(env.ENDLESS ?? 0);
  const endlessFrom = Number(env.ENDLESS_FROM ?? 10);
  const chapterChest = Number(env.CHAPTER_CHEST ?? 0);
  const stars = env.STARS !== '0';
  const lateGrowth = env.LATE_GROWTH ? Number(env.LATE_GROWTH) : null;
  const setupFor = (m: MetaSave, stage: number): BattleSetup => {
    const s = battleSetup(m, stage);
    if (lateGrowth !== null && stage > 20) s.enemyHp = stageHp(20) * lateGrowth ** (stage - 20);
    return s;
  };
  const out: { player: number; days: Day[] }[] = [];

  for (let p = first; p < first + players; p++) {
    const m = newMeta();
    m.tutorial = true;
    let seed = 100000 * (p + 1) + (ads ? 50000 : 0);
    const log: Day[] = [];
    let stop = 0;
    for (let d = 0; d < days; d++) {
      const today = dayName(d);
      const earned = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
      let spent = 0;
      let buys = 0;
      let time = 0;
      let battles = 0;
      let frontierTries = 0;
      let frontierWins = 0;
      const book = (s: Source, n: number) => (earned[s] += n);
      const spend = () => {
        let bought = false;
        for (let n = nextBuy(m); n && m.crystals >= n.cost; n = nextBuy(m)) {
          n.buy();
          spent += n.cost;
          buys++;
          bought = true;
        }
        return bought;
      };
      const claimAll = () => {
        for (let i = 0; i < m.daily.tasks.length; i++) book('tasks', claimTask(m, i));
        book('tasks', claimBonus(m));
        for (const id of TRACK_IDS) while (true) {
          const c = claimTier(m, id);
          if (!c) break;
          book('achievements', c);
        }
      };

      rollDay(m, today);
      book('login', claimLogin(m, today));
      book('chest', claimChest(m, today));
      if (ads)
        for (let i = 0; i < 3; i++) {
          book('ads', claimAd(m, today));
          time += AD_MIN;
        }
      spend();

      // the daily challenge: the free attempt, and the ad one unless the top tier is reached
      for (const ad of ads ? [false, true] : [false]) {
        if (ad && m.challenge.best >= BALANCE.challenge.tiers[BALANCE.challenge.tiers.length - 1].wave) break;
        const bonus = beginAttempt(m, today, ad);
        if (bonus === null) break;
        book('challenge', bonus);
        const c = todaysChallenge(m, today);
        const cs = challengeSetup(m, c);
        cs.enemyHp *= setupFor(m, c.stage).enemyHp / stageHp(c.stage);
        const pl = play(m, c.seed, cs, false);
        addProgress(m, 'challenge');
        const r = bookAttempt(m, pl.b.wave);
        recordChallenge(m, r.bestTier);
        book('challenge', r.crystals);
        time += pl.b.seconds / 60 + OVERHEAD + (ad ? AD_MIN : 0);
        battles++;
        claimAll();
        if (spend()) {
          /* a purchase */
        }
      }

      let frontierLosses = 0;
      let farm = m.cleared;
      let hardLosses = 0;
      while (time < minutes) {
        const all = m.cleared >= BALANCE.meta.stageCount;
        const atFrontier = !all && frontierLosses < 2;
        if (!atFrontier && endless > 0 && m.cleared >= endlessFrom) {
          book('endless', endless);
          m.crystals += endless;
          time += ENDLESS_MIN + OVERHEAD;
          battles++;
          addProgress(m, 'play');
          claimAll();
          if (spend()) frontierLosses = 0;
          continue;
        }
        const { stage, hard } = atFrontier ? { stage: m.stage, hard: false } : offFrontier(m, farm, hardLosses, stars);
        const purse = new Purse();
        const pl = play(m, seed++, hard ? hardSetup(setupFor(m, stage)) : setupFor(m, stage), ads);
        const b = pl.b;
        const won = b.result === 'won';
        m.runs++;
        addProgress(m, 'play');
        if (won) addProgress(m, 'win');
        const before = m.cleared;
        const run = { stage, won, wave: b.wave, kills: b.kills };
        const r = purse.settle(m, run, hard ? hardReward(m, run) : undefined);
        if (won && stars) bookStars(m, stage, hard, runStars(true, pl.revived, Math.max(0, b.wall) / b.wallMax));
        book('runs', r.crystals);
        if (r.firstClear && chapterChest > 0 && stage % 10 === 0 && stage > before) {
          m.crystals += chapterChest * (stage / 10);
          book('chapter', chapterChest * (stage / 10));
        }
        if (ads && doublesLeft(m) > 0 && purse.paid > 0) {
          book('double', purse.double(m, true));
          time += AD_MIN;
        }
        if (pl.revived) time += AD_MIN;
        time += b.seconds / 60 + OVERHEAD;
        battles++;
        if (atFrontier) {
          frontierTries++;
          if (won) frontierWins++;
          frontierLosses = won ? 0 : frontierLosses + 1;
          if (frontierLosses >= 2) farm = m.cleared;
        } else if (hard) hardLosses = won ? 0 : hardLosses + 1;
        else if (!won) farm = Math.max(1, farm - 1);
        claimAll();
        if (spend()) frontierLosses = hardLosses = 0;
      }
      const n = nextBuy(m);
      log.push({
        day: d + 1,
        earned,
        spent,
        buys,
        battles,
        frontierTries,
        frontierWins,
        cleared: m.cleared,
        left: m.crystals,
        next: n ? n.cost : null,
        heroes: HERO_KINDS.map((k) => m.heroes[k]),
        workshop: WORKSHOP_IDS.map((id) => m.workshop[id]),
        maxed: maxed(m),
      });
      // a few days past maxing out are enough to see what follows
      if (log[log.length - 1].maxed && ++stop >= 3) break;
    }
    out.push({ player: p, days: log });
  }
  const fs = proc.getBuiltinModule('node:fs') as Fs;
  const dir = env.OUT_DIR ?? 'ref/balance/economy';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${env.TAG ?? 'base'}-${profile}-${ads ? 'ads' : 'noads'}-p${first}.json`, JSON.stringify({ profile, ads, minutes, out }));
}, 7_200_000);
