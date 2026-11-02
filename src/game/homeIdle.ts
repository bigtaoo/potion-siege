// A later player's hand on the home screen: past the guide's first battles, once they have sat
// still IDLE_HINT.home seconds the hand points at the best thing to do - something to claim, then
// a potion level, a workshop level, then the start button - or, over a panel with none of that in
// it, at its close. A pick shown IGNORE_LIMIT times and not taken rests until the next battle.
// The settings' hints switch turns it off (and the battle's idle hand with it, view/nextMove.ts);
// a guide step or the one-time upgrade pointer, each with a hand of its own, keeps it away.

import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { gameDay } from '../sim/daily';
import { guideMark } from '../view/home/guideMark';
import type { HomeActions, HomePanel } from '../view/Home';
import { IGNORE_LIMIT } from '../view/nextMove';
import { IDLE_HINT, TOP_PICK_UNTIL } from '../view/nudges';
import type { Rule } from './guideRules';
import { RULES } from './homeGuide';
import { LATER_RULES } from './homeGuideLate';

/** What the hand may point at, best first; the guide's own steps say where each one is. */
const PICKS: [string, Rule][] = [
  ['gift', RULES.gift],
  ['login', RULES.login],
  ['tasks', RULES.tasks],
  ['chapterChest', LATER_RULES.chapterChest],
  ['starChest', LATER_RULES.starChest],
  ['codex', RULES.codex],
  ['shop', RULES.shop],
  ['upgrade', RULES.upgrade],
  ['workshop', RULES.workshop],
  ['start', RULES.toBattle1],
];

/** Panels the hand keeps off: questions for the player to answer. */
const ASKING = new Set<HomePanel>(['privacy', 'remind']);

/** The close button of a panel with nothing to point at in it. */
const CLOSE = 'panel_close';

interface Shown {
  id: string;
  label: string;
  rule: Rule | null;
}

interface Idle {
  runs: number;
  /** Seconds since the screen was built or the player last touched it. */
  quiet: number;
  root: Container | null;
  /** The screen may have the hand at all. */
  on: boolean;
  /** The hand's mark while it is up; the pick it showed last on this screen (a tap on it after
   *  the press took the mark away still counts); how often each pick was shown since last taken. */
  mark: Container | null;
  last: Shown | null;
  shows: Map<string, number>;
}

const states = new WeakMap<Game, Idle>();

function state(g: Game): Idle {
  let s = states.get(g);
  if (s) return s;
  const made: Idle = { runs: g.save.runs, quiet: 0, root: null, on: false, mark: null, last: null, shows: new Map() };
  states.set(g, made);
  // a touch or key starts the wait over, and takes a hand that is up away
  const touch = () => {
    made.quiet = 0;
    made.mark?.destroy({ children: true });
    made.mark = null;
  };
  if (typeof window !== 'undefined') for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, touch);
  // the battle's idle hand reports through the same event
  g.hud.next.onHint = (kind, result) => g.analytics.track('idle_hint', { where: 'battle', target: kind, result, run: g.save.runs });
  return made;
}

/** The home screen just built (`root`): its wait starts. `busy`: a hand of the guide's or the
 *  upgrade pointer's is on it. */
export function idleHome(g: Game, root: Container, busy: boolean): void {
  const s = state(g);
  if (s.runs !== g.save.runs) {
    s.runs = g.save.runs;
    s.shows.clear();
  }
  g.hud.hints = g.save.sound.hints;
  s.root = root;
  s.quiet = 0;
  s.mark = null;
  s.last = null;
  s.on = !busy && !g.autoplay && g.save.sound.hints && g.save.runs >= TOP_PICK_UNTIL && !ASKING.has(g.panel);
}

/** A home frame `dt` seconds on: the pointer's hand pushes toward what it points at and back, and
 *  the hand comes up once the player has sat still long enough. */
export function homeFrame(g: Game, dt: number): void {
  const hand = g.hintHand && !g.hintHand.destroyed ? g.hintHand.children[0] : null;
  if (hand) hand.y = 14 + Math.sin(performance.now() / 160) * 14;
  const s = states.get(g);
  if (!s?.on || !s.root || s.root.destroyed || s.mark) return;
  s.quiet += dt;
  if (s.quiet >= IDLE_HINT.home) show(g, s);
}

/** The best pick on this screen, not shown in vain too often, whose button is on it. */
function pick(g: Game, s: Idle): (Shown & { target: Container }) | null {
  const root = s.root!;
  const today = gameDay(g.save, new Date());
  const where = { panel: g.panel, tab: g.tab, today };
  const tired = (id: string) => (s.shows.get(id) ?? 0) >= IGNORE_LIMIT;
  for (const [id, rule] of PICKS) {
    if (tired(id) || !rule.can(g.save, today)) continue;
    const label = rule.aim(g.save, where);
    const target = label ? root.getChildByLabel(label, true) : null;
    if (label && target) return { id, label, rule, target };
  }
  const close = g.panel && !tired('close') ? root.getChildByLabel(CLOSE, true) : null;
  return close ? { id: 'close', label: CLOSE, rule: null, target: close } : null;
}

function show(g: Game, s: Idle): void {
  s.quiet = 0;
  const p = pick(g, s);
  if (!p || !g.menuFit) return;
  const root = s.root!;
  guideMark(root, p.target, null, true, g.menuFit, null, g.panel !== null);
  s.mark = root.children[root.children.length - 1];
  g.hintHand = s.mark.getChildByLabel('hintHand', true);
  s.last = { id: p.id, label: p.label, rule: p.rule };
  s.shows.set(p.id, (s.shows.get(p.id) ?? 0) + 1);
  g.analytics.track('idle_hint', { where: 'home', target: p.id, result: 'shown', run: g.save.runs });
}

/** Whether an action is the tap the hand showed: what the pick is for, or the tab or panel
 *  button on its way there. */
export function took(last: Shown, name: string, arg: unknown): boolean {
  if (!last.rule) return name === 'panel' && arg === null;
  if (last.rule.tap(name, arg) === 'done') return true;
  if (name === 'tab') return last.label === `tab_${arg}`;
  return name === 'panel' && (last.label === `top_${arg}` || (last.label === 'stageCard' && arg === 'chapters'));
}

/** The home screen's actions, each first checked against the hand's last pick. */
export function idleActs(g: Game, act: HomeActions): HomeActions {
  const out = { ...act } as Record<string, unknown>;
  for (const [name, fn] of Object.entries(act)) {
    if (typeof fn !== 'function') continue;
    out[name] = (...args: unknown[]) => {
      const s = states.get(g);
      const last = s?.last;
      if (s && last && took(last, name, args[0])) {
        s.last = null;
        s.shows.delete(last.id);
        g.analytics.track('idle_hint', { where: 'home', target: last.id, result: 'followed', run: g.save.runs });
      }
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  }
  return out as unknown as HomeActions;
}
