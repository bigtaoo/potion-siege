import { describe, expect, it } from 'vitest';
import { endlessSetup } from './endless';
import { newMeta, parseMeta } from './meta';
import { SAVES } from './setupCatalog';
import { BALANCE, REACTION_IDS } from './types';
import {
  bookWeekFloor,
  civilDate,
  civilDays,
  claimWeekTask,
  countWeekReaction,
  daysLeft,
  newWeek,
  parseWeek,
  rollWeek,
  weekClaimable,
  weekGoal,
  weekOf,
  weekProgress,
  weekReward,
  weekRule,
  weekSetup,
  weekTasks,
  WEEK_RULES,
} from './week';
import { towerSetup } from './weekTower';

const W = BALANCE.alchemy.week;

describe('the week', () => {
  it('names a week by its Monday, without the local clock', () => {
    expect(['2026-11-02', '2026-11-05', '2026-11-08'].map(weekOf)).toEqual(['2026-11-02', '2026-11-02', '2026-11-02']);
    expect(weekOf('2026-11-09')).toBe('2026-11-09');
    expect(weekOf('2026-01-01')).toBe('2025-12-29');
    expect(weekOf('2024-03-02')).toBe('2024-02-26');
    expect(['2026-11-02', '2026-11-05', '2026-11-08'].map(daysLeft)).toEqual([7, 4, 1]);
    expect(civilDays(1970, 1, 1)).toBe(0);
    for (let d = -800; d < 40_000; d += 97) {
      const [y, m, dd] = civilDate(d).split('-').map(Number);
      expect(civilDays(y!, m!, dd!)).toBe(d);
    }
  });

  it('has one rule for everyone in a week, and every rule turns up', () => {
    expect(weekRule('2026-11-02')).toEqual(weekRule('2026-11-02'));
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const r = weekRule(civilDate(civilDays(2026, 1, 5) + 7 * i));
      expect(WEEK_RULES).toContain(r.id);
      expect(REACTION_IDS).toContain(r.reaction);
      seen.add(r.id);
    }
    expect([...seen].sort()).toEqual([...WEEK_RULES].sort());
  });

  it('starts over only on a later week', () => {
    const m = newMeta();
    rollWeek(m, '2026-11-04');
    m.alchemy.week.best = 9;
    rollWeek(m, '2026-11-08');
    expect(m.alchemy.week).toMatchObject({ id: '2026-11-02', best: 9 });
    // a clock turned back opens nothing
    rollWeek(m, '2026-10-20');
    expect(m.alchemy.week.best).toBe(9);
    rollWeek(m, '2026-11-09');
    expect(m.alchemy.week).toEqual({ ...newWeek(), id: '2026-11-09' });
  });

  it('bends the tower by its rule', () => {
    const base = endlessSetup(SAVES.late());
    for (const id of WEEK_RULES) {
      const r = W.rules[id] as { power: number; hp?: number; damage?: number; wall?: number };
      const s = weekSetup(base, { id, reaction: 'combustion' });
      expect(s.enemyHp).toBeCloseTo(base.enemyHp * (r.hp ?? 1), 9);
      expect(s.wallHp).toBeCloseTo(base.wallHp * (r.wall ?? 1), 9);
      if (id === 'focus') expect(s.focus).toEqual({ id: 'combustion', power: r.power });
      else expect(s.reactionScale).toBeCloseTo((base.reactionScale ?? 1) * r.power, 9);
      if (r.damage) expect(s.heroDamage.fire).toBeCloseTo(base.heroDamage.fire * r.damage, 9);
    }
    const m = SAVES.late();
    const s = towerSetup(m, '2026-11-05');
    expect(m.alchemy.week.id).toBe('2026-11-02');
    expect(s).toEqual(weekSetup(endlessSetup(m), weekRule('2026-11-02')));
  });

  it('counts its tasks and pays each once', () => {
    const m = newMeta();
    rollWeek(m, '2026-11-05');
    expect(weekTasks(false)).not.toContain('tower');
    expect(weekTasks(true)).toContain('tower');
    expect(bookWeekFloor(m, 12)).toBe(true);
    expect(bookWeekFloor(m, 8)).toBe(false);
    // a climb begun last week books nothing into this one
    expect(bookWeekFloor(m, 30, '2026-10-26')).toBe(false);
    expect(m.alchemy.week.best).toBe(12);
    for (let i = 0; i < weekGoal('react'); i++) countWeekReaction(m, REACTION_IDS[i % REACTION_IDS.length]!);
    expect(weekProgress(m, 'react')).toBe(weekGoal('react'));
    expect(weekProgress(m, 'kinds')).toBe(Math.min(weekGoal('kinds'), REACTION_IDS.length));
    expect(weekProgress(m, 'tower')).toBe(12);
    expect(weekClaimable(m, true)).toBe(true);
    const start = m.crystals;
    expect(claimWeekTask(m, 'react')).toBe(weekReward('react'));
    expect(claimWeekTask(m, 'react')).toBe(0);
    expect(claimWeekTask(m, 'tower')).toBe(0);
    expect(m.crystals).toBe(start + weekReward('react'));
    expect(parseMeta(JSON.stringify(m)).alchemy.week).toEqual(m.alchemy.week);
  });

  it('reads junk as a fresh week and clamps the rest', () => {
    expect(parseWeek(null)).toEqual(newWeek());
    expect(parseWeek({ id: 'monday', best: 5000, reactions: -3, kinds: ['combustion', 'nope'], challenges: 40, claimed: ['react', 'x'] })).toEqual({
      ...newWeek(),
      best: 999,
      kinds: ['combustion'],
      challenges: 7,
      claimed: ['react'],
    });
  });
});
