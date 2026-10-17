import { describe, expect, it } from 'vitest';
import { addProgress, ALL_DONE_BONUS, bonusReady, canClaimLogin, claimBonus, claimLogin, claimTask, dayOf, loginDay, loginReward, rollDay, taskGoal, tasksClaimable } from './daily';
import { newMeta, parseMeta } from './meta';
import { BALANCE } from './types';

describe('daily', () => {
  it('formats the local date', () => {
    expect(dayOf(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pays the login reward once a day and walks the seven-day track without resetting', () => {
    const m = newMeta();
    expect(claimLogin(m, '2026-10-15')).toBe(loginReward(0));
    expect(canClaimLogin(m, '2026-10-15')).toBe(false);
    expect(claimLogin(m, '2026-10-15')).toBe(0);
    // a missed day still gives the next reward, not day one again
    expect(claimLogin(m, '2026-10-18')).toBe(loginReward(1));
    for (let d = 20; d < 25; d++) claimLogin(m, `2026-10-${d}`);
    expect(loginDay(m)).toBe(0);
    expect(m.crystals).toBe(BALANCE.daily.login.reduce((a, b) => a + b, 0));
  });

  it('rolls the same three distinct tasks for a date, new ones the next day', () => {
    const a = newMeta();
    const b = newMeta();
    rollDay(a, '2026-10-15');
    rollDay(b, '2026-10-15');
    expect(a.daily.tasks).toEqual(b.daily.tasks);
    expect(new Set(a.daily.tasks.map((t) => t.id)).size).toBe(BALANCE.daily.taskCount);
    addProgress(a, a.daily.tasks[0].id, 5);
    rollDay(a, '2026-10-15');
    expect(a.daily.tasks[0].progress).toBe(Math.min(5, taskGoal(a.daily.tasks[0].id)));
    rollDay(a, '2026-10-16');
    expect(a.daily.tasks.every((t) => t.progress === 0)).toBe(true);
  });

  it('resets the result ×2 count with the day, not within it', () => {
    const m = newMeta();
    rollDay(m, '2026-10-15');
    m.daily.doubles = 3;
    rollDay(m, '2026-10-15');
    expect(m.daily.doubles).toBe(3);
    rollDay(m, '2026-10-16');
    expect(m.daily.doubles).toBe(0);
  });

  it('pays a task once, only when it is done', () => {
    const m = newMeta();
    rollDay(m, '2026-10-15');
    const id = m.daily.tasks[1].id;
    expect(claimTask(m, 1)).toBe(0);
    addProgress(m, id, 10_000);
    expect(m.daily.tasks[1].progress).toBe(taskGoal(id));
    expect(tasksClaimable(m)).toBe(true);
    expect(claimTask(m, 1)).toBeGreaterThan(0);
    expect(claimTask(m, 1)).toBe(0);
    expect(tasksClaimable(m)).toBe(false);
  });

  it('pays the bonus once all three tasks are claimed, once a day', () => {
    const m = newMeta();
    rollDay(m, '2026-10-15');
    expect(bonusReady(m)).toBe(false);
    m.daily.tasks.forEach((t, i) => {
      addProgress(m, t.id, 10_000);
      expect(claimBonus(m)).toBe(0);
      claimTask(m, i);
    });
    expect(bonusReady(m)).toBe(true);
    expect(tasksClaimable(m)).toBe(true);
    const before = m.crystals;
    expect(claimBonus(m)).toBe(ALL_DONE_BONUS);
    expect(m.crystals).toBe(before + ALL_DONE_BONUS);
    expect(claimBonus(m)).toBe(0);
    expect(tasksClaimable(m)).toBe(false);
    expect(parseMeta(JSON.stringify(m)).daily.bonus).toBe(true);
    rollDay(m, '2026-10-16');
    expect(m.daily.bonus).toBe(false);
    expect(bonusReady(m)).toBe(false);
  });

  it('keeps the daily state through a save', () => {
    const m = newMeta();
    rollDay(m, '2026-10-15');
    addProgress(m, m.daily.tasks[2].id, 1);
    claimLogin(m, '2026-10-15');
    expect(parseMeta(JSON.stringify(m)).daily).toEqual(m.daily);
  });
});
