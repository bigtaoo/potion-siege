// The players' replays played again into stats (replayStats.ts, `npm run replays`).

import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { BASE_SETUP, type BattleSetup } from './meta';
import { REPLAY_VERSION, takeReplay, type Replay } from './replay';
import { formatReport } from './replayReport';
import { addReplay, newStats, stageKey } from './replayStats';
import { ENEMY_KINDS } from './types';

function record(seed: number, setup: BattleSetup, ticks: number): { b: Battle; r: Replay } {
  const b = new Battle(seed, setup);
  for (let i = 0; i < ticks && b.result === null; i++) {
    botAct(b);
    b.step();
    b.drain();
  }
  return { b, r: takeReplay(b) };
}

const WEAK: BattleSetup = { ...BASE_SETUP, wallHp: 60, enemyHp: BASE_SETUP.enemyHp * 20 };

describe('replay stats', () => {
  it('counts where the wall fell and what took it down', () => {
    const s = newStats();
    const { b, r } = record(4, WEAK, 20 * 60 * 30);
    expect(b.result).toBe('lost');
    expect(addReplay(s, r)).toBe(true);
    const st = s.stages.get('1')!;
    expect([st.battles, st.won, st.lost, st.left]).toEqual([1, 0, 1, 0]);
    expect([...st.losses]).toEqual([[b.wave, 1]]);
    expect([...st.falls]).toEqual([[b.wave, 1]]);
    // every hit point the wall had went to some enemy kind, none unaccounted
    const total = [...s.wall.values()].reduce((a, n) => a + n, 0);
    expect(total).toBeGreaterThanOrEqual(WEAK.wallHp - 0.01);
    expect([...s.wall.keys()].every((k) => (ENEMY_KINDS as readonly string[]).includes(k) || k === 'anvil slam')).toBe(true);
    expect(s.summons).toBeGreaterThan(0);
    expect([...s.merges.keys()].every((k) => /^[a-z]+ \d★$/.test(k))).toBe(true);
  });

  it('counts the offers shown and the cards picked', () => {
    const s = newStats();
    const { r } = record(9, { ...BASE_SETUP, startGold: 600 }, 3 * 60 * 30);
    addReplay(s, r);
    const picks = r.commands.filter((c) => c.type === 'choose').length;
    expect([...s.picked.values()].reduce((a, n) => a + n, 0)).toBe(picks);
    for (const [id, n] of s.picked) expect(s.offered.get(id) ?? 0).toBeGreaterThanOrEqual(n);
  });

  it('counts a battle still going as left, and keys hard and endless apart', () => {
    const s = newStats();
    addReplay(s, record(1, BASE_SETUP, 300).r);
    addReplay(s, record(1, { ...BASE_SETUP, stage: 3, hard: true }, 300).r);
    addReplay(s, record(1, { ...BASE_SETUP, endless: true }, 300).r);
    expect([...s.stages.keys()]).toEqual(['1', '3h', 'endless']);
    expect(s.stages.get('1')!.left).toBe(1);
    expect(stageKey(record(1, { ...BASE_SETUP, stage: 7 }, 1).r)).toBe('7');
  });

  it('leaves out replays of another version and those that do not play back', () => {
    const s = newStats();
    const { r } = record(2, BASE_SETUP, 600);
    expect(addReplay(s, { ...r, version: REPLAY_VERSION - 1 })).toBe(false);
    expect(addReplay(s, { ...r, hash: r.hash ^ 1 })).toBe(false);
    expect(addReplay(s, { ...r, commands: [...r.commands, { type: 'summon', tick: r.ticks + 5 }] })).toBe(false);
    expect([s.played, s.oldVersion, s.desynced, s.stages.size]).toEqual([0, 1, 2, 0]);
  });

  it('prints every part', () => {
    const s = newStats();
    addReplay(s, record(4, WEAK, 20 * 60 * 30).r);
    addReplay(s, record(5, BASE_SETUP, 600).r);
    const text = formatReport(s);
    for (const part of ['replays played 2', '  stage  runs', 'wall damage by source', 'merges (', 'skill offers:', 'commander casts']) expect(text).toContain(part);
    expect(text).toMatch(/^\s+1\s+2\s+0%\s+1\s+1 .*lost w\d+×1/m);
  });
});
