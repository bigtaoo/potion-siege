// The first battle's tutorial as the game runs it: begun and ended, moved on each frame, its
// steps logged, and the page rect each step points at.

import type { Game } from '../app';
import { t } from '../i18n';
import { slotCenter, type Battle } from '../sim/battle';
import { mergeablePair, Tutorial } from '../sim/tutorial';
import { BALANCE, type BattleEvent } from '../sim/types';
import { SKILL_BOX } from '../view/Overlay';
import type { Lesson, Rect } from '../view/Tutorial';
import { DESIGN_H, DESIGN_W, type MenuFit } from '../view/viewport';

/** The tutorial starts with the first battle of stage 1 on a save that has not seen it. */
export function beginTutorial(g: Game): void {
  if (g.autoplay || g.save.tutorial || g.battle?.setup.stage !== 1) return;
  g.tutorial = new Tutorial();
  g.tutLog = { step: 'summon', shownT: null, assisted: false };
  g.hud.hint = false;
  g.hud.nudge = false;
}

/** Done or skipped: never again on this save. */
export function endTutorial(g: Game, skipped: boolean): void {
  const tut = g.tutorial;
  if (!tut) return;
  g.analytics.track('tutorial_end', { step: skipped ? (tut.step ?? 'done') : 'done', skipped });
  g.tutorial = null;
  g.hud.hint = g.save.achievements.stats.merges === 0;
  g.hud.nudge = true;
  g.save.tutorial = true;
  g.store();
}

/** Moves the tutorial on and points at what its step needs, in page units. */
export function lesson(g: Game, b: Battle | null, events: BattleEvent[], m: MenuFit, dt: number): void {
  const tut = g.tutorial;
  if (tut && b) {
    tut.update(b, events);
    logStep(g, tut, b);
    if (tut.done) endTutorial(g, false);
    // a step left alone is done for the player, and the banner says so
    const helped = !tut.done && !g.overlay.visible && !g.ended ? tut.assist(b) : null;
    if (helped) {
      const step = helped as 'summon' | 'merge' | 'upgrade';
      g.hud.say(t(`tutorial.helped.${step}`));
      g.analytics.track('tutorial_assist', { step, t: Math.round(b.seconds) });
      g.run?.onAssist(step);
      if (g.tutLog?.step === step) g.tutLog.assisted = true;
    }
  }
  const step = g.tutorial && b && g.root.visible ? g.tutorial.showing(b) : null;
  // the pick shows over the skill cards, every other step over the battle itself
  const up = step === 'pick' ? g.overlay.visible : !g.overlay.visible;
  g.lessons.scale.set(m.scale);
  g.lessons.show(step && up && b ? lessonFor(g, step, b, m) : null, m.w, m.h, m.wide, dt);
}

/** `tutorial_step` once a step is done: when it first showed and was done (battle seconds),
 *  and whether the player or the assist did it. */
export function logStep(g: Game, tut: Tutorial, b: Battle): void {
  const log = g.tutLog;
  if (!log) return;
  if (log.shownT === null && tut.showing(b) === log.step) log.shownT = Math.round(b.seconds);
  if (tut.step === log.step) return;
  g.analytics.track('tutorial_step', { step: log.step, shownT: log.shownT, doneT: Math.round(b.seconds), by: log.assisted ? 'assist' : 'player' });
  g.tutLog = tut.step ? { step: tut.step, shownT: null, assisted: false } : null;
}

export function lessonFor(g: Game, step: NonNullable<ReturnType<Tutorial['showing']>>, b: Battle, m: MenuFit): Lesson {
  // the board's design units to page units
  const k = g.root.scale.x / m.scale;
  const ox = g.root.x / m.scale;
  const oy = g.root.y / m.scale;
  const page = (r: Rect): Rect => ({ x: ox + r.x * k, y: oy + r.y * k, w: r.w * k, h: r.h * k });
  const board = page({ x: 0, y: 0, w: DESIGN_W, h: DESIGN_H });
  const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  if (step === 'pick') {
    const s = Math.min(1, (m.w - 40) / SKILL_BOX.w, (m.h - 40) / SKILL_BOX.h);
    const box = { x: m.w / 2 - (SKILL_BOX.w * s) / 2, y: m.h / 2 - (SKILL_BOX.h * s) / 2, w: SKILL_BOX.w * s, h: SKILL_BOX.h * s };
    return { step, holes: [], from: center(box), clear: box };
  }
  if (step === 'merge') {
    const pair = mergeablePair(b)!;
    const holes = pair.map((slot) => {
      const c = slotCenter(slot);
      const g = BALANCE.grid;
      return page({ x: c.x - g.cellW / 2, y: c.y - g.cellH / 2, w: g.cellW, h: g.cellH });
    });
    return { step, holes, from: center(holes[0]), to: center(holes[1]), clear: board };
  }
  const r = page(g.hud.buttonRect(step));
  return { step, holes: [r], from: { x: r.x + r.w / 2, y: r.y + 8 }, clear: board };
}
