// The guided tour of the first three home screens (docs/onboarding-plan.md, section 3): which step
// of the chapter is up and what it points at on the screen about to be built, its one line and skip
// link, and which taps do the step, are on its way, or go round it. Soft: nothing else is locked,
// and a tap off its path just counts it as gone round (the next one waits for any open panel).
// A step whose button would do nothing (no crystals for it, nothing to claim) is passed over.

import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { t } from '../i18n';
import { achievementsClaimable } from '../sim/achievements';
import { canClaimLogin, tasksClaimable } from '../sim/daily';
import { guideChapter, guideLeft, markGuide, type GuideId, type GuideStep } from '../sim/guide';
import { chestReady, heroCost, heroUnlocked, WORKSHOP_IDS, workshopCost, type MetaSave, type WorkshopId } from '../sim/meta';
import { HERO_KINDS, type HeroKind } from '../sim/types';
import { canClaimWelcome, welcomeOn } from '../sim/welcome';
import { setCodexPage } from '../view/codex';
import type { HomeActions, HomePanel, HomeTab } from '../view/Home';
import { challengeShown } from '../view/nudges';
import { guideMark } from '../view/home/guideMark';

/** What a step points at on this screen: the label of its target (null while a panel that is
 *  not its own is open), its line, and the potion an upgrade step is after. */
export interface GuideAim {
  step: GuideStep;
  chapter: 1 | 2 | 3;
  target: string | null;
  text: string | null;
  hint: HeroKind | null;
}

type Tap = 'done' | 'path';
type Where = { panel: HomePanel; tab: HomeTab; today: string };

interface Rule {
  /** The step's button would do something now. */
  can(m: MetaSave, today: string): boolean;
  aim(m: MetaSave, w: Where): string | null;
  /** How an action counts: the step itself, on its way, or (undefined) round it. */
  tap(act: string, arg: unknown): Tap | undefined;
}

/** The first potion a level is affordable for, in the lineup's order. */
export function guideHero(m: MetaSave): HeroKind | null {
  return HERO_KINDS.find((k) => {
    const cost = heroCost(m.heroes[k]);
    return heroUnlocked(m, k) && cost !== null && cost <= m.crystals;
  }) ?? null;
}

/** The cheapest workshop level the crystals pay for. */
export function guideWorkshop(m: MetaSave): WorkshopId | null {
  let best: WorkshopId | null = null;
  let low = Infinity;
  for (const id of WORKSHOP_IDS) {
    const cost = workshopCost(id, m.workshop[id]);
    if (cost !== null && cost <= m.crystals && cost < low) [best, low] = [id, cost];
  }
  return best;
}

/** A tab's step: the tab's button, then `inner` once it is open; nothing over a panel. */
const onTab = (tab: HomeTab, inner: string) => (w: Where) => (w.panel ? null : w.tab === tab ? inner : `tab_${tab}`);
/** A top-bar panel's step: its button, then `inner` in the panel. */
const inPanel = (panel: HomePanel & string, top: string, inner: string) => (w: Where) => (w.panel === panel ? inner : w.panel ? null : top);

const upgrade: Rule = {
  can: (m) => guideHero(m) !== null,
  aim: (m, w) => onTab('potions', `price_${guideHero(m)}`)(w),
  tap: (act, arg) => (act === 'hero' ? 'done' : (act === 'tab' && arg === 'potions') || act === 'panel' ? 'path' : undefined),
};

const toBattle: Rule = {
  can: () => true,
  aim: (_m, w) => onTab('battle', 'start')(w),
  // never gone round: the chapter ends at the start button however the player gets there
  tap: (act) => (act === 'play' ? 'done' : 'path'),
};

const PANEL_STEPS = new Set<GuideStep>(['gift', 'login', 'tasks']);

const RULES: Record<GuideStep, Rule> = {
  gift: {
    can: (m, today) => welcomeOn(m) && canClaimWelcome(m, today),
    aim: (_m, w) => inPanel('welcome', 'top_welcome', 'claim_welcome')(w),
    tap: (act, arg) => (act === 'claimWelcome' ? 'done' : act === 'panel' && arg === 'welcome' ? 'path' : undefined),
  },
  upgrade,
  upgradeMore: upgrade,
  upgradeLast: upgrade,
  toBattle1: toBattle,
  login: {
    can: (m, today) => canClaimLogin(m, today),
    aim: (_m, w) => inPanel('login', 'top_login', 'claim_login')(w),
    tap: (act, arg) => (act === 'claimLogin' ? 'done' : act === 'panel' && arg === 'login' ? 'path' : undefined),
  },
  tasks: {
    can: (m) => tasksClaimable(m),
    aim: (_m, w) => inPanel('tasks', 'top_tasks', 'claim_task')(w),
    tap: (act, arg) => (act === 'claimTask' || act === 'claimBonus' ? 'done' : act === 'panel' && arg === 'tasks' ? 'path' : undefined),
  },
  workshop: {
    can: (m) => guideWorkshop(m) !== null,
    aim: (m, w) => onTab('workshop', `buy_${guideWorkshop(m)}`)(w),
    tap: (act, arg) => (act === 'workshop' ? 'done' : act === 'tab' && arg === 'workshop' ? 'path' : undefined),
  },
  toBattle2: toBattle,
  codex: {
    can: (m) => achievementsClaimable(m),
    aim: (_m, w) => onTab('codex', 'claim_feat')(w),
    tap: (act, arg) => (act === 'claimTier' ? 'done' : act === 'tab' && arg === 'codex' ? 'path' : undefined),
  },
  shop: {
    can: (m, today) => chestReady(m, today),
    aim: (_m, w) => onTab('shop', 'chest')(w),
    tap: (act, arg) => (act === 'claimChest' ? 'done' : act === 'tab' && arg === 'shop' ? 'path' : undefined),
  },
  // only pointed at, never asked for: seen once it is on screen
  challenge: {
    can: (m) => challengeShown(m),
    aim: (_m, w) => onTab('battle', 'challenge')(w),
    tap: (act, arg) => (act === 'tab' && arg === 'battle' ? 'path' : undefined),
  },
  toBattle3: toBattle,
};

/** Taps that count for no step: the settings' switches, the leaderboard's tabs, closing a panel. */
const NEUTRAL = new Set(['sound', 'language', 'copyId', 'shareData', 'remind', 'adPrivacy', 'privacyPolicy', 'boardTab', 'stage', 'pickStage']);

/** When each game's current step was first pointed at (ms), for its wait. */
const shown = new WeakMap<Game, { step: GuideStep; at: number }>();

/** Marks a step done, skipped, gone round (other) or passed over (none: nothing to do), once. */
export function guideMarked(g: Game, step: GuideId, result: 'done' | 'skipped' | 'other' | 'none'): void {
  if (!markGuide(g.save, step)) return;
  // the guide's upgrade is the old one-time pointer's too
  if (step === 'upgrade') g.save.upgradeHint = true;
  const was = shown.get(g);
  const waitS = was?.step === step ? Math.round((performance.now() - was.at) / 100) / 10 : 0;
  g.analytics.track('guide_step', { id: step, chapter: guideChapter(g.save) ?? 0, waitS, result, run: g.save.runs });
  g.store();
}

/** The step to point at on the home screen about to be built, passing over the ones with
 *  nothing to do; null outside the first three home screens, in autoplay or while the privacy
 *  question is up. */
export function guideAim(g: Game, panel: HomePanel, tab: HomeTab, today: string): GuideAim | null {
  const chapter = guideChapter(g.save);
  if (!chapter || g.autoplay || panel === 'privacy') return null;
  for (const step of guideLeft(g.save)) {
    const rule = RULES[step];
    if (!rule.can(g.save, today)) {
      guideMarked(g, step, 'none');
      continue;
    }
    const target = rule.aim(g.save, { panel, tab, today });
    // the codex opens on its achievements while they are the step
    if (step === 'codex' && target === 'claim_feat') setCodexPage('feats');
    const was = shown.get(g);
    if (target && was?.step !== step) shown.set(g, { step, at: performance.now() });
    return { step, chapter, target, text: guideText(step, g.save.stage), hint: rule === upgrade ? guideHero(g.save) : null };
  }
  return null;
}

/** The step's line: none on the upgrade's second and third pointing. */
export function guideText(step: GuideStep, stage: number): string | null {
  if (step === 'upgradeMore' || step === 'upgradeLast') return null;
  if (step === 'toBattle1') return t('guide.toBattle1', { n: stage });
  if (step === 'toBattle2' || step === 'toBattle3') return t('guide.toBattle', { n: stage });
  return t(`guide.${step}`);
}

/** The home screen's actions with the guide's bookkeeping first: a tap that does the step marks
 *  it done, one off its path marks it gone round. */
export function guideActs(g: Game, act: HomeActions, aim: GuideAim | null): HomeActions {
  if (!aim?.target) return act;
  const out = { ...act } as Record<string, unknown>;
  for (const [name, fn] of Object.entries(act)) {
    if (typeof fn !== 'function' || NEUTRAL.has(name)) continue;
    out[name] = (...args: unknown[]) => {
      guideTap(g, aim, name, args[0]);
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  }
  return out as unknown as HomeActions;
}

/** Counts one tap for the step being pointed at. */
export function guideTap(g: Game, aim: GuideAim, name: string, arg: unknown): void {
  if (name === 'panel' && arg === null) return;
  const tap = RULES[aim.step].tap(name, arg);
  if (tap === 'done') guideMarked(g, aim.step, 'done');
  else if (tap === undefined) guideMarked(g, aim.step, 'other');
}

/** Every step of the chapter left but its start button, as skipped. */
export function guideSkip(g: Game): void {
  const left = guideLeft(g.save);
  for (const step of left.slice(0, -1)) guideMarked(g, step, 'skipped');
}

/** The hand and the line on the screen just built (`root`), at the step's target; the challenge
 *  button's step is done once it is shown. The upgrade steps' hand is the potions tab's own. The
 *  top-bar panels' claim buttons have them from below, clear of the panel. */
export function drawGuide(g: Game, root: Container, aim: GuideAim | null, onSkip: () => void): void {
  if (!aim?.target || !g.menuFit) return;
  const target = root.getChildByLabel(aim.target, true);
  if (!target) return;
  const skip = aim.step.startsWith('toBattle') ? null : onSkip;
  guideMark(root, target, aim.text, aim.hint === null, g.menuFit, skip, PANEL_STEPS.has(aim.step));
  if (aim.step === 'challenge') guideMarked(g, 'challenge', 'done');
}
