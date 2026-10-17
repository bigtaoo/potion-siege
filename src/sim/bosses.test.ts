import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { hashBattle } from './hash';
import { battleSetup, newMeta } from './meta';
import { FP, TICK_RATE, ticks } from './math/fixed';
import { Prng } from './math/prng';
import { checkReplay, playReplay, takeReplay } from './replay';
import { BALANCE, BOSS_KINDS, ENEMY_KINDS, isBoss, type BattleEvent, type BossKind, type Enemy, type HeroKind } from './types';
import { bossForStage, FIRST_STAGE, planWave, waveHp, type Spawn } from './waves';

const CH = BALANCE.bosses.chapter;

type Raw = { pending: Spawn[]; spawn(s: Spawn): void; harm(e: Enemy, damage: number, by: HeroKind | undefined): void };

/** A boss walking down on its own: no wave spawns, no commander. */
function alone(kind: BossKind, hp = 1e9): { b: Battle; raw: Raw; boss: Enemy } {
  const b = new Battle(1, battleSetup(newMeta(), FIRST_STAGE[kind]));
  const raw = b as unknown as Raw;
  raw.pending = [];
  b.enemies = [];
  b.commanderCooldown = 1e9;
  raw.spawn({ at: 0, kind, hp });
  return { b, raw, boss: b.enemies[0] };
}

const clockAlone = () => alone('clock').b;

describe('chapter bosses', () => {
  it('gives each chapter of ten stages its own boss, the steam tank first', () => {
    expect(bossForStage(1)).toBe('boss');
    expect(bossForStage(CH)).toBe('boss');
    expect(bossForStage(CH + 1)).toBe('clock');
    expect(bossForStage(2 * CH)).toBe('clock');
    for (const kind of BOSS_KINDS) expect(bossForStage(FIRST_STAGE[kind])).toBe(kind);
  });

  it('counts only the chapter bosses as bosses', () => {
    expect(ENEMY_KINDS.filter(isBoss)).toEqual([...BOSS_KINDS]);
  });

  it("sends the chapter's boss on both boss waves, and no other boss", () => {
    for (const stage of [CH, CH + 1, 2 * CH]) {
      for (const wave of [5, 10]) {
        for (let seed = 1; seed < 6; seed++) {
          const bosses = planWave(wave, new Prng(seed), stage).filter((s) => isBoss(s.kind));
          expect(bosses.map((s) => s.kind)).toEqual([bossForStage(stage)]);
        }
      }
    }
  });

  it('lets the clocktower strider breed mice at half a mouse from its pendulum door', () => {
    const b = clockAlone();
    const P = BALANCE.bosses.clock;
    const mice = () => b.enemies.filter((e) => e.kind === 'runner');
    while (b.time < ticks(P.first) - 1) b.step();
    expect(mice()).toHaveLength(0);
    b.step();
    expect(b.drain().some((e) => e.type === 'brood')).toBe(true);
    expect(mice()).toHaveLength(P.mice);
    const hp = Math.round(waveHp(b.wave) * BALANCE.enemies.runner.hp * b.setup.enemyHp * P.hp * FP);
    for (const m of mice()) {
      expect(m.maxHp).toBe(hp);
      expect(m.gold).toBe(P.gold * 1000);
    }
    const clock = b.enemies.find((e) => e.kind === 'clock')!;
    expect(new Set(mice().map((m) => m.x)).size).toBe(P.mice);
    for (const m of mice()) expect(Math.abs(m.x - clock.x)).toBeLessThanOrEqual(P.spread * FP + 1);
    while (b.time < ticks(P.first + P.every)) b.step();
    expect(mice()).toHaveLength(2 * P.mice);
  });

  it("puts the tripod's hits on its bell jar first, cracked by frost, grown back after a while", () => {
    const T = BALANCE.bosses.tripod;
    const { b, raw, boss } = alone('tripod', 100 * FP);
    const jar = 100 * T.shield * FP;
    expect(boss.shield).toBe(jar);
    raw.harm(boss, 10 * FP, 'fire');
    expect(boss.hp).toBe(100 * FP);
    expect(boss.shield).toBe(jar - 10 * T.other * FP);
    raw.harm(boss, 5 * FP, 'ice');
    expect(boss.shield).toBe(jar - (10 * T.other + 5 * T.ice) * FP);
    while (boss.shield) raw.harm(boss, 10 * FP, 'ice');
    expect(boss.hp).toBe(100 * FP);
    expect(b.drain().some((e) => e.type === 'jar' && !e.up)).toBe(true);
    // bare: the body's own resistances
    raw.harm(boss, 10 * FP, 'poison');
    expect(boss.hp).toBe(85 * FP);
    for (let i = 0; i < ticks(T.regrow) - 1; i++) b.step();
    expect(boss.shield).toBe(0);
    b.step();
    expect(boss.shield).toBe(jar);
  });

  it('lets the anvil leap ahead every so often, but not while slowed', () => {
    const A = BALANCE.bosses.anvil;
    const walk = (slowed: boolean) => {
      const { b, boss } = alone('anvil');
      const y0 = boss.y;
      let leaps = 0;
      for (let i = 0; i < ticks(A.every + A.leapTime) + 1; i++) {
        if (slowed) (boss.slowTime = 10), (boss.slowFactor = 1000);
        b.step();
        leaps += b.drain().filter((e) => e.type === 'leap').length;
      }
      return { leaps, moved: boss.y - y0, speed: boss.speed };
    };
    const free = walk(false);
    const held = walk(true);
    expect(free.leaps).toBe(1);
    expect(held.leaps).toBe(0);
    expect(free.moved - held.moved).toBeGreaterThan(A.leap * FP - ticks(A.leapTime) * free.speed - FP);
  });

  it('lets the anvil slam the wall, biting into it and dazing the potions under it', () => {
    const A = BALANCE.bosses.anvil;
    const { b, boss } = alone('anvil');
    b.slots[0] = { id: 900, kind: 'fire', star: 1, slot: 0, cooldown: 0 };
    b.slots[6] = { id: 901, kind: 'fire', star: 1, slot: 6, cooldown: 0 };
    const x0 = (BALANCE.grid.x0 + BALANCE.grid.cellW / 2) * FP;
    boss.x = x0;
    boss.y = b.wallFront(x0) - boss.radius;
    b.step();
    expect(boss.atWall).toBe(true);
    const wall = b.wall;
    let slam: Extract<BattleEvent, { type: 'slam' }> | undefined;
    for (let i = 0; i < ticks(A.slamFirst) && !slam; i++) {
      b.step();
      slam = b.drain().find((e) => e.type === 'slam') as typeof slam;
    }
    expect(slam?.slots).toEqual([0]);
    expect(wall - b.wall).toBeGreaterThanOrEqual(A.slam * BALANCE.enemies.anvil.wallDps * FP - FP);
    // the potions already stood a tick of it: heroes step after the enemies
    expect(b.slots[0]!.stunTime).toBe(ticks(A.stun) - 1);
    expect(b.slots[6]!.stunTime).toBeUndefined();
  });

  it("breaks the gear king's rim at half health into a faster core with the weaknesses turned round", () => {
    const G = BALANCE.bosses.gear;
    const { b, raw, boss } = alone('gear', 100 * FP);
    const speed = boss.speed;
    raw.harm(boss, 10 * FP, 'fire');
    expect(boss.hp).toBe(95 * FP);
    // one huge hit stops at half: the core always shows
    raw.harm(boss, 1000 * FP, 'poison');
    expect(boss.hp).toBe(50 * FP);
    expect(boss.core).toBe(true);
    expect(b.drain().some((e) => e.type === 'crack')).toBe(true);
    raw.harm(boss, 10 * FP, 'arcane');
    expect(boss.hp).toBe(50 * FP);
    for (let i = 0; i < ticks(G.guard); i++) b.step();
    raw.harm(boss, 10 * FP, 'arcane');
    expect(boss.hp).toBe(37.5 * FP);
    raw.harm(boss, 10 * FP, 'poison');
    expect(boss.hp).toBe(32.5 * FP);
    expect(boss.speed).toBe(Math.trunc((speed * G.speed * 1000) / 1000));
  });

  for (const kind of BOSS_KINDS.slice(1)) {
    it(`plays a stage with a ${kind} wave back to the same hash`, () => {
      // weak enough waves that the bot lives to see the boss do its thing
      const setup = battleSetup(newMeta(), FIRST_STAGE[kind]);
      const b = new Battle(5, { ...setup, startGold: 2000, enemyHp: Math.min(setup.enemyHp, 0.3) });
      let seen = false;
      while (b.result === null && b.time < 400 * TICK_RATE) {
        if (b.choices) b.apply({ type: 'noReroll' });
        botAct(b);
        b.step();
        b.drain();
        seen ||= b.enemies.some((e) => e.kind === kind);
      }
      expect(seen).toBe(true);
      const replay = takeReplay(b);
      expect(hashBattle(playReplay(replay))).toBe(hashBattle(b));
      expect(checkReplay(JSON.parse(JSON.stringify(replay)))).toBe(true);
    });
  }
});
