// The guided tour of the first three home screens (docs/onboarding-plan.md, section 3): which step
// of the chapter is up and what it points at on the screen about to be built, its one line and skip
// link, and which taps do the step, are on its way, or go round it. Soft: nothing else is locked,
// and a tap off its path just counts it as gone round (the next one waits for any open panel).
// A step whose button would do nothing (no crystals for it, nothing to claim) is passed over.
// After a claim in a panel the next step is elsewhere, so the hand goes to the panel's close, or to
// its own claim while that is still there to take (a tap on it then goes round no step).

import type { Container } from 'pixi.js';
import type { Game } from '../app';
import { t } from '../i18n';
import { achievementsClaimable } from '../sim/achievements';
import { canClaimLogin, tasksClaimable } from '../sim/daily';
import { guideChapter, guideLeft, laterLeft, markGuide, type GuideId, type GuideLater, type GuideStep } from '../sim/guide';
import { chestReady, WORKSHOP_IDS, workshopCost, type MetaSave, type WorkshopId } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { canClaimWelcome, welcomeOn } from '../sim/welcome';
import { setCodexPage } from '../view/codex';
import type { HomeActions, HomePanel, HomeTab } from '../view/Home';
import { challengeShown, lineupUpgrade } from '../view/nudges';
import { guideMark } from '../view/home/guideMark';
import { inPanel, onTab, type Rule } from './guideRules';
import { LATER_RULES } from './homeGuideLate';

/** What a step points at on this screen: the label of its target (null while a panel that is
 *  not its own and not one the guide leaves open is up), its line, the potion an upgrade step is
 *  after, and whether the target is in a panel (the hand and line from below). */
export interface GuideAim {
  step: GuideStep | GuideLater;
  chapter: 1 | 2 | 3 | null;
  target: string | null;
  text: string | null;
  hint: HeroKind | null;
  inPanel: boolean;
}

/** Panels a step claims in, left open after it: the hand then goes to their close button. */
const CLAIM_PANELS = new Set<HomePanel>(['welcome', 'login', 'tasks', 'chapters']);

/** The claim of a top-bar panel, when there is one to take: the hand goes there before the close. */
const PANEL_CLAIMS: Partial<Record<NonNullable<HomePanel>, { label: string; acts: string[]; can: (m: MetaSave, today: string) => boolean }>> = {
  welcome: { label: 'claim_welcome', acts: ['claimWelcome'], can: (m, today) => welcomeOn(m) && canClaimWelcome(m, today) },
  login: { label: 'claim_login', acts: ['claimLogin'], can: (m, today) => canClaimLogin(m, today) },
  tasks: { label: 'claim_task', acts: ['claimTask', 'claimBonus'], can: (m) => tasksClaimable(m) },
};

/** The first fielded potion a level is affordable for, in the lineup's order. */
export function guideHero(m: MetaSave): HeroKind | null {
  return lineupUpgrade(m);
}

/** The wall's level when the crystals pay for it (what a lost battle needs most), else the
 *  cheapest workshop level they pay for. */
export function guideWorkshop(m: MetaSave): WorkshopId | null {
  const wall = workshopCost('wall', m.workshop.wall);
  if (wall !== null && wall <= m.crystals) return 'wall';
  let best: WorkshopId | null = null;
  let low = Infinity;
  for (const id of WORKSHOP_IDS) {
    const cost = workshopCost(id, m.workshop[id]);
    if (cost !== null && cost <= m.crystals && cost < low) [best, low] = [id, cost];
  }
  return best;
}

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

export const RULES: Record<GuideStep, Rule> = {
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
  heroes2: upgrade,
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
  heroes3: upgrade,
  // only pointed at, never asked for: seen once it is on screen
  challenge: {
    can: (m) => challengeShown(m),
    aim: (_m, w) => onTab('battle', 'challenge')(w),
    tap: (act, arg) => (act === 'tab' && arg === 'battle' ? 'path' : undefined),
  },
  toBattle3: toBattle,
};

const ALL_RULES: Record<GuideStep | GuideLater, Rule> = { ...RULES, ...LATER_RULES };

/** Taps that count for no step: the settings' switches, the leaderboard's tabs, closing a panel. */
const NEUTRAL = new Set(['sound', 'language', 'copyId', 'shareData', 'remind', 'adPrivacy', 'privacyPolicy', 'boardTab', 'stage', 'pickStage']);

/** When each game's current step was first pointed at (ms), for its wait. */
const shown = new WeakMap<Game, { step: GuideStep | GuideLater; at: number }>();

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
 *  nothing to do; before a chapter's start step (or after the three chapters) the first one-time
 *  pointer with something to do. Null before the first battle, in autoplay or while the privacy
 *  question is up. */
export function guideAim(g: Game, panel: HomePanel, tab: HomeTab, today: string): GuideAim | null {
  const chapter = guideChapter(g.save);
  if (g.save.runs < 1 || g.autoplay || panel === 'privacy') return null;
  const later = () => laterLeft(g.save).find((id) => LATER_RULES[id].can(g.save, today));
  for (const step of guideLeft(g.save)) {
    const late = step.startsWith('toBattle') ? later() : undefined;
    if (late) return aimAt(g, late, chapter, panel, tab, today);
    if (!RULES[step].can(g.save, today)) {
      guideMarked(g, step, 'none');
      continue;
    }
    return aimAt(g, step, chapter, panel, tab, today);
  }
  const late = later();
  return late ? aimAt(g, late, chapter, panel, tab, today) : null;
}

function aimAt(g: Game, step: GuideStep | GuideLater, chapter: 1 | 2 | 3 | null, panel: HomePanel, tab: HomeTab, today: string): GuideAim {
  const rule = ALL_RULES[step];
  const target = rule.aim(g.save, { panel, tab, today });
  // the codex opens on its achievements while they are the step
  if (step === 'codex' && target === 'claim_feat') setCodexPage('feats');
  const was = shown.get(g);
  if (target && was?.step !== step) shown.set(g, { step, at: performance.now() });
  if (!target && panel && CLAIM_PANELS.has(panel)) {
    const own = PANEL_CLAIMS[panel];
    const claim = own?.can(g.save, today) ? own.label : null;
    return { step, chapter, target: claim ?? 'panel_close', text: null, hint: null, inPanel: !!claim };
  }
  // the start step's line only by the start button, not over another tab's cards
  const text = step.startsWith('toBattle') && target !== 'start' ? null : guideText(step, g.save.stage);
  return { step, chapter, target, text, hint: rule === upgrade ? guideHero(g.save) : null, inPanel: panel !== null };
}

/** The step's line: none on the upgrade's second and third pointing. */
export function guideText(step: GuideStep | GuideLater, stage: number): string | null {
  if (step === 'upgradeMore' || step === 'upgradeLast') return null;
  if (step === 'heroes2' || step === 'heroes3') return t('guide.upgrade');
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
  const tap = ALL_RULES[aim.step].tap(name, arg);
  // the open panel's own claim, pointed at while the step waits elsewhere
  if (tap === undefined && Object.values(PANEL_CLAIMS).some((c) => c.label === aim.target && c.acts.includes(name))) return;
  if (tap === 'done') guideMarked(g, aim.step, 'done');
  else if (tap === undefined) guideMarked(g, aim.step, 'other');
}

/** Every step of the chapter left but its start button, as skipped; or the one-time pointer
 *  shown (`step`). */
export function guideSkip(g: Game, step?: GuideStep | GuideLater): void {
  if (step && step in LATER_RULES) {
    guideMarked(g, step, 'skipped');
    return;
  }
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
  guideMark(root, target, aim.text, aim.hint === null, g.menuFit, skip, aim.inPanel);
  if (aim.target === 'challenge') guideMarked(g, 'challenge', 'done');
}
