// What the players' replays say once played again (`npm run replays`, scripts/replays.test.ts):
// where the wall falls (by stage and wave), what bites it, which merges are made and how the
// skill offers and the commander are used. Things the run events (src/analytics) do not carry.
// Ported in spirit from Holy Kicker's replay report (D:\standing e83fe22).

import type { Battle } from './battle';
import { K } from './field';
import { FP, ticks, times } from './math/fixed';
import { playReplay, REPLAY_VERSION, type Replay } from './replay';
import { hashBattle } from './hash';
import { BALANCE, type BattleEvent, type EnemyKind } from './types';

/** One stage's battles: how they ended, and the waves the wall fell on. */
export interface StageStats {
  battles: number;
  won: number;
  lost: number;
  /** Left for another battle, or still going when the page was hidden. */
  left: number;
  /** Each time the wall fell (revived or not), by wave. */
  falls: Map<number, number>;
  /** The battles lost for good, by the wave they ended on. */
  losses: Map<number, number>;
}

export interface ReplayStats {
  /** Replays played; those of another REPLAY_VERSION; those that did not play back to their hash. */
  played: number;
  oldVersion: number;
  desynced: number;
  /** Keyed by stage, `<stage>h` on hard mode, `endless` for endless runs. */
  stages: Map<string, StageStats>;
  /** Wall hit points lost, by enemy kind, and to the anvil's slams. */
  wall: Map<string, number>;
  /** Merges by `<kind> <star>★`. */
  merges: Map<string, number>;
  summons: number;
  /** Skill cards shown, and picked; offers rerolled and revives used. */
  offered: Map<string, number>;
  picked: Map<string, number>;
  rerolls: number;
  revives: number;
  casts: Map<string, number>;
}

export function newStats(): ReplayStats {
  return { played: 0, oldVersion: 0, desynced: 0, stages: new Map(), wall: new Map(), merges: new Map(), summons: 0, offered: new Map(), picked: new Map(), rerolls: 0, revives: 0, casts: new Map() };
}

const add = <K>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

export function stageKey(r: Replay): string {
  return r.setup.endless ? 'endless' : `${r.setup.stage}${r.setup.hard ? 'h' : ''}`;
}

function stageOf(s: ReplayStats, key: string): StageStats {
  let st = s.stages.get(key);
  if (!st) s.stages.set(key, (st = { battles: 0, won: 0, lost: 0, left: 0, falls: new Map(), losses: new Map() }));
  return st;
}

/** What an anvil's slam takes off the wall (bosses.ts slam). */
const SLAM = K.wallDps.anvil * ticks(BALANCE.bosses.anvil.slam);

type Biters = Map<number, { kind: EnemyKind; bite: number }>;

/** The enemies at the wall and what each takes off it a tick (enemyTick.ts). */
function biters(b: Battle, out: Biters): void {
  for (const e of b.enemies) if (e.atWall) out.set(e.id, { kind: e.kind, bite: times(K.wallDps[e.kind], e.heft) });
}

/** Plays `r` again into `s`; false when it was not counted (another version, or a desync). */
export function addReplay(s: ReplayStats, r: Replay): boolean {
  if (r.version !== REPLAY_VERSION) {
    s.oldVersion++;
    return false;
  }
  const falls: number[] = [];
  const wall = new Map<string, number>();
  const merges = new Map<string, number>();
  const offered = new Map<string, number>();
  const casts = new Map<string, number>();
  let summons = 0;
  let before = 0;
  const atWall: Biters = new Map();
  let battle: Battle;
  try {
    battle = playReplay(
      r,
      (b, events: readonly BattleEvent[]) => {
        let slammed = 0;
        for (const e of events) {
          if (e.type === 'merge') add(merges, `${e.kind} ${e.star}★`);
          else if (e.type === 'summon') summons++;
          else if (e.type === 'cast') add(casts, e.skill);
          else if (e.type === 'slam') slammed += SLAM;
          else if (e.type === 'end' && !e.won) falls.push(b.wave);
        }
        // the wall's drop this tick: the slams, the rest shared by the enemies at it before or after
        const lost = before - b.wall;
        if (lost <= 0) return;
        if (slammed) add(wall, 'anvil slam', Math.min(slammed, lost));
        biters(b, atWall);
        const rest = lost - Math.min(slammed, lost);
        const total = [...atWall.values()].reduce((n, e) => n + e.bite, 0);
        if (rest > 0 && total > 0) for (const e of atWall.values()) add(wall, e.kind, (rest * e.bite) / total);
        else if (rest > 0) add(wall, 'other', rest);
      },
      {
        // an offer's cards, as the player picks one or rerolls them all
        beforeCommand: (b, c) => {
          if ((c.type === 'choose' || c.type === 'reroll') && b.choices) for (const id of b.choices) add(offered, id);
        },
        beforeStep: (b) => {
          before = b.wall;
          atWall.clear();
          biters(b, atWall);
        },
      },
    );
    if (hashBattle(battle) !== r.hash) throw new Error('hash');
  } catch {
    s.desynced++;
    return false;
  }
  s.played++;
  const st = stageOf(s, stageKey(r));
  st.battles++;
  if (battle.result === 'won') st.won++;
  else if (battle.result === 'lost') {
    st.lost++;
    add(st.losses, battle.wave);
  } else st.left++;
  for (const w of falls) add(st.falls, w);
  for (const [k, n] of wall) add(s.wall, k, n / FP);
  for (const [k, n] of merges) add(s.merges, k, n);
  for (const [k, n] of offered) add(s.offered, k, n);
  for (const [k, n] of casts) add(s.casts, k, n);
  for (const c of r.commands) {
    if (c.type === 'choose') add(s.picked, c.id);
    else if (c.type === 'reroll') s.rerolls++;
    else if (c.type === 'revive') s.revives++;
  }
  s.summons += summons;
  return true;
}
