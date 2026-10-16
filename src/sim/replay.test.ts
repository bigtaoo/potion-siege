import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { hashBattle } from './hash';
import { BASE_SETUP, type BattleSetup } from './meta';
import { checkReplay, playReplay, REPLAY_VERSION, takeReplay, type Replay } from './replay';
import { TICK_RATE } from './math/fixed';

const EVERY = 300;

/** A bot run that also buys a few offers early, rerolls every other offer (and declines the
 *  rest) and revives once when it loses; the hashes every EVERY ticks and the replay at its end. */
function record(seed: number, setup: BattleSetup, seconds: number): { replay: Replay; hashes: Map<number, number> } {
  const b = new Battle(seed, setup);
  const hashes = new Map<number, number>();
  let offers = 0;
  let revived = false;
  while (b.time < seconds * TICK_RATE) {
    if (b.result === 'lost' && !revived) revived = b.revive();
    if (b.result !== null) break;
    // the plain bot spends its gold on summons; RICH starts with enough for a few offers
    if (b.upgrades < 4 && b.canUpgrade()) b.upgrade();
    if (b.choices && !b.rerolled) b.apply({ type: offers++ % 2 ? 'reroll' : 'noReroll' });
    botAct(b);
    b.step();
    b.drain();
    if (b.time % EVERY === 0) hashes.set(b.time, hashBattle(b));
  }
  return { replay: takeReplay(b), hashes };
}

function checkpoints(r: Replay): Map<number, number> {
  const seen = new Map<number, number>();
  playReplay(r, (b) => {
    if (b.time % EVERY === 0) seen.set(b.time, hashBattle(b));
  });
  return seen;
}

const RICH: BattleSetup = { ...BASE_SETUP, startGold: 600 };
// a battle the bot loses: a thin wall against stage-10 hit points
const LOSING: BattleSetup = { ...BASE_SETUP, stage: 10, enemyHp: BASE_SETUP.enemyHp * 4, wallHp: Math.round(BASE_SETUP.wallHp / 3) };

describe('replay', () => {
  it('plays a bot run back to the same state at every checkpoint and at the end', () => {
    const { replay, hashes } = record(7, RICH, 600);
    expect(replay.commands.some((c) => c.type === 'choose')).toBe(true);
    expect(replay.commands.some((c) => c.type === 'reroll')).toBe(true);
    expect(replay.commands.some((c) => c.type === 'noReroll')).toBe(true);
    expect(hashes.size).toBeGreaterThan(10);
    expect(checkpoints(replay)).toEqual(hashes);
    expect(hashBattle(playReplay(replay))).toBe(replay.hash);
  });

  it('plays a lost and revived battle back, through JSON', () => {
    const { replay, hashes } = record(11, LOSING, 1200);
    expect(replay.commands.some((c) => c.type === 'revive')).toBe(true);
    const copy: Replay = JSON.parse(JSON.stringify(replay));
    expect(checkpoints(copy)).toEqual(hashes);
    expect(checkReplay(copy)).toBe(true);
  });

  it('fails a changed hash, a missing command or an old version', () => {
    const { replay } = record(3, BASE_SETUP, 120);
    expect(checkReplay(replay)).toBe(true);
    expect(checkReplay({ ...replay, hash: (replay.hash + 1) >>> 0 })).toBe(false);
    expect(checkReplay({ ...replay, commands: replay.commands.slice(1) })).toBe(false);
    expect(checkReplay({ ...replay, version: REPLAY_VERSION - 1 })).toBe(false);
  });

  it('hashes integers only', () => {
    const b = new Battle(1);
    b.gold = 0.5;
    expect(() => hashBattle(b)).toThrow(/non-integer/);
  });
});
