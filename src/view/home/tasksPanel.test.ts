// The daily tasks panel as the player meets it on the home screen (tasksPanel.ts, the claims in
// game/homeScreen.ts): today's tasks set in the save, claimed by their buttons' English captions.
import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { home } from '../../game/homeScreen';
import { buttons, englishPage, tap, texts, veteran, world, type World } from '../../game/testWorld';
import { ALL_DONE_BONUS, gameDay, taskGoal, taskReward, type DailyTask } from '../../sim/daily';

beforeAll(englishPage);

/** A veteran whose tasks today are `tasks` (play pays 75, summon 60, win 100), on the panel. */
function tasks(list: DailyTask[], bonus = false): World {
  const m = veteran();
  m.daily.day = gameDay(m, new Date());
  m.daily.tasks = list;
  m.daily.bonus = bonus;
  const w = world(m);
  w.game['tab'] = 'battle';
  home(w.game);
  tap(w.stage, t('tasks'));
  expect(w.game['panel']).toBe('tasks');
  return w;
}

const task = (id: DailyTask['id'], done: boolean | number, claimed = false): DailyTask => ({
  id,
  progress: typeof done === 'number' ? done : done ? taskGoal(id) : 0,
  claimed,
});

describe('the daily tasks panel', () => {
  it('lists each task with how far along it is', () => {
    const w = tasks([task('play', 2), task('summon', false), task('win', true, true)]);
    const shown = texts(w.stage);
    expect(shown).toContain(t('task.play', { n: 3 }));
    expect(shown).toContain('2/3');
    expect(shown).toContain(`0/${taskGoal('summon')}`);
    expect(shown).toContain(t('allDoneCount', { n: 1, total: 3 }));
    expect(w.events('dialog')).toContainEqual({ id: 'tasks', action: 'open', auto: false, run: 8 });
  });

  it('pays a done task once, and marks it claimed', () => {
    const w = tasks([task('play', true), task('summon', false), task('win', true, true)]);
    const reward = String(taskReward('play'));
    tap(w.stage, reward);
    expect(w.save().crystals).toBe(100 + taskReward('play'));
    expect(w.save().daily.tasks[0].claimed).toBe(true);
    expect(w.game['panel']).toBe('tasks');
    expect(buttons(w.stage, reward)).toHaveLength(0);
    expect(texts(w.stage).filter((s) => s === t('claimed'))).toHaveLength(2);
    expect(w.events('daily_claim')).toEqual([{ item: 'task_play', crystals: taskReward('play'), total: 100 + taskReward('play') }]);
    expect(w.events('dialog')).toContainEqual({ id: 'tasks', action: 'claim', item: 'play', run: 8 });
  });

  it('pays nothing for a task not done yet', () => {
    const w = tasks([task('play', 2), task('summon', false), task('win', true, true)]);
    tap(w.stage, String(taskReward('play')));
    tap(w.stage, String(taskReward('summon')));
    expect(w.save().crystals).toBe(100);
    expect(w.save().daily.tasks.map((x) => x.claimed)).toEqual([false, false, true]);
    expect(w.events('daily_claim')).toEqual([]);
  });

  it('holds the chest until all three are claimed', () => {
    const w = tasks([task('play', true), task('summon', false), task('win', true, true)]);
    tap(w.stage, String(ALL_DONE_BONUS));
    expect(w.save().crystals).toBe(100);
    expect(w.save().daily.bonus).toBe(false);
  });

  it('pays the chest once all three are claimed, then shows it claimed', () => {
    const w = tasks([task('play', true, true), task('summon', true, true), task('win', true, true)]);
    expect(texts(w.stage)).toContain(t('allDoneCount', { n: 3, total: 3 }));
    tap(w.stage, String(ALL_DONE_BONUS));
    expect(w.save().crystals).toBe(100 + ALL_DONE_BONUS);
    expect(w.save().daily.bonus).toBe(true);
    expect(w.game['panel']).toBe('tasks');
    expect(buttons(w.stage, String(ALL_DONE_BONUS))).toHaveLength(0);
    expect(texts(w.stage).filter((s) => s === t('claimed'))).toHaveLength(4);
    expect(w.events('daily_claim')).toEqual([{ item: 'task_all', crystals: ALL_DONE_BONUS, total: 100 + ALL_DONE_BONUS }]);
  });

  it('shows the chest claimed on a day it was paid', () => {
    const w = tasks([task('play', true, true), task('summon', true, true), task('win', true, true)], true);
    expect(buttons(w.stage, String(ALL_DONE_BONUS))).toHaveLength(0);
    expect(texts(w.stage).filter((s) => s === t('claimed'))).toHaveLength(4);
  });

  it('rolls new tasks on a new day', () => {
    const m = veteran();
    m.daily.day = '2020-01-01';
    m.daily.tasks = [task('play', true, true), task('summon', true, true), task('win', true, true)];
    m.daily.bonus = true;
    const w = world(m);
    home(w.game, 'tasks');
    expect(w.game.save.daily.tasks.every((x) => !x.claimed && x.progress === 0)).toBe(true);
    expect(w.game.save.daily.bonus).toBe(false);
    expect(texts(w.stage)).toContain(t('allDoneCount', { n: 0, total: 3 }));
  });

  it('closes with the cross, and says so', () => {
    const w = tasks([task('play', true), task('summon', false), task('win', true, true)]);
    tap(w.stage, '✕');
    expect(w.game['panel']).toBeNull();
    expect(texts(w.stage)).not.toContain(t('allDone'));
    expect(w.events('dialog')).toContainEqual({ id: 'tasks', action: 'close', run: 8 });
  });
});
